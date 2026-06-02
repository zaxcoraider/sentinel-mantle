// Server-only client for the DGrid AI gateway (https://dgrid.ai), which exposes
// an OpenAI-compatible /v1/chat/completions endpoint across 100+ models.
//
// NEVER import this from a client component — it reads DGRID_API_KEY from the
// server environment. Plain fetch (no SDK) keeps the bundle lean and matches
// the project's fetch-over-axios convention.

export class DgridError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'DgridError';
    this.status = status;
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const baseUrl = (): string => process.env.DGRID_BASE_URL ?? 'https://api.dgrid.ai/v1';

// Model IDs are env-driven so they can be swapped without a code change. The
// defaults are confirmed present on DGrid's model list; bump SMART to
// anthropic/claude-opus-4.8 (or 4.7) in .env once verified live.
export const smartModel = (): string =>
  process.env.DGRID_MODEL_SMART ?? 'anthropic/claude-sonnet-4.6';
export const fastModel = (): string =>
  process.env.DGRID_MODEL_FAST ?? 'anthropic/claude-haiku-4.5';

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

/**
 * Calls the DGrid chat-completions endpoint and returns the assistant's raw
 * text content. Throws DgridError (with an HTTP-ish status) on any failure so
 * callers can map it to a response code.
 */
export const chat = async (
  messages: ChatMessage[],
  opts: { model: string; maxTokens?: number; temperature?: number },
): Promise<string> => {
  const key = process.env.DGRID_API_KEY;
  if (!key) {
    throw new DgridError('AI is not configured (missing DGRID_API_KEY).', 503);
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 700,
      }),
    });
  } catch {
    throw new DgridError('Could not reach the AI gateway.', 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new DgridError(
      `AI gateway error (${res.status}). ${detail.slice(0, 200)}`.trim(),
      502,
    );
  }

  const data = (await res.json()) as ChatCompletion;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new DgridError('AI returned an empty response.', 502);
  }
  return content;
};
