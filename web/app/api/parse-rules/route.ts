import { NextResponse } from 'next/server';
import { z } from 'zod';
import { chat, smartModel, DgridError, type ChatMessage } from '@/lib/ai/dgrid';
import { PROTOCOL_LABELS, addressForProtocol } from '@/lib/protocols';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  text: z.string().trim().min(3).max(1000),
});

// The shape the model must return. allowedProtocols are constrained to known
// labels (resolved to addresses server-side) so the AI never emits a raw
// address. Bounds mirror the on-chain SafetyRules form in onboard-store.ts.
const aiSchema = z.object({
  maxDrawdownBps: z.number().int().min(1).max(10000),
  maxTxPerHour: z.number().int().min(1).max(1000),
  oracleDeviationBps: z.number().int().min(1).max(5000),
  dailyVolumeCapUsd: z.number().int().min(100),
  timeOfDayMin: z.number().int().min(0).max(23),
  timeOfDayMax: z.number().int().min(0).max(23),
  allowedProtocols: z.array(z.string()),
  notes: z.string().max(600),
});

const systemPrompt = `You are the safety-rule compiler for Sentinel, a circuit breaker for autonomous on-chain AI agents on Mantle Network. Convert the user's plain-English risk description into a SafetyRules configuration.

Return ONLY a JSON object with EXACTLY these keys:
- maxDrawdownBps: integer 1-10000, basis points (100 = 1%). Pause if the agent's portfolio value drops more than this.
- maxTxPerHour: integer 1-1000. Transaction rate cap.
- oracleDeviationBps: integer 1-5000, basis points. Pause if a price feed deviates from the last on-chain price by more than this.
- dailyVolumeCapUsd: integer >= 100. Pause if more than this many USD move in any 24h window.
- timeOfDayMin: integer 0-23, UTC hour. Start of the agent's active-hours window.
- timeOfDayMax: integer 0-23, UTC hour, strictly greater than timeOfDayMin. End of the active-hours window. Activity outside this window raises a warning.
- allowedProtocols: array of strings. Use ONLY names from this exact list: ${JSON.stringify(PROTOCOL_LABELS)}. Use [] if the user does not restrict protocols. NEVER invent names or output addresses.
- notes: string, at most 60 words. Briefly state any assumptions and defaults you applied.

Rules:
- Fill EVERY field. For anything the user did not specify, choose a sensible, moderately conservative default and mention it in notes.
- Convert percentages to basis points (e.g. "15%" -> 1500, "2%" -> 200).
- If the user names an unsupported protocol, omit it and say so in notes.
- Output strictly valid JSON only. No markdown fences, no text outside the JSON object.`;

interface ParsedRules {
  maxDrawdownBps: number;
  maxTxPerHour: number;
  oracleDeviationBps: number;
  dailyVolumeCapUsd: number;
  timeOfDayMin: number;
  timeOfDayMax: number;
  allowedProtocols: string[];
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Describe your safety rules in 3–1000 characters.' },
      { status: 400 },
    );
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: parsed.data.text },
  ];

  let raw: string;
  try {
    raw = await chat(messages, { model: smartModel() });
  } catch (e) {
    const status = e instanceof DgridError ? e.status : 502;
    const message = e instanceof Error ? e.message : 'AI request failed.';
    return NextResponse.json({ error: message }, { status });
  }

  // Some models wrap JSON in code fences despite instructions — strip defensively.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: 'AI returned malformed output. Try rephrasing your description.' },
      { status: 502 },
    );
  }

  const ai = aiSchema.safeParse(json);
  if (!ai.success) {
    return NextResponse.json(
      { error: 'AI produced an out-of-range config. Try rephrasing.' },
      { status: 502 },
    );
  }

  // Preserve the form's invariant (min < max) without hard-failing on a bad pair.
  let { timeOfDayMin, timeOfDayMax } = ai.data;
  if (timeOfDayMin >= timeOfDayMax) {
    timeOfDayMin = 0;
    timeOfDayMax = 23;
  }

  // Resolve protocol labels -> addresses, dropping anything not in our list.
  const allowedProtocols = ai.data.allowedProtocols
    .map((label) => addressForProtocol(label))
    .filter((a): a is string => Boolean(a));

  const rules: ParsedRules = {
    maxDrawdownBps: ai.data.maxDrawdownBps,
    maxTxPerHour: ai.data.maxTxPerHour,
    oracleDeviationBps: ai.data.oracleDeviationBps,
    dailyVolumeCapUsd: ai.data.dailyVolumeCapUsd,
    timeOfDayMin,
    timeOfDayMax,
    allowedProtocols,
  };

  return NextResponse.json({ rules, notes: ai.data.notes });
}
