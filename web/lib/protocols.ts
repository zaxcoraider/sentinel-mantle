// Shared protocol-allowlist options used by both the onboarding rules step and
// the AI rule-parser. Addresses are placeholders until the real Mantle DEX
// addresses are populated. The AI parser only ever returns labels from this
// list — it never emits a raw address — and the server resolves label ->
// address here, so an LLM is kept out of anything address-sensitive.

export interface ProtocolOption {
  label: string;
  address: string;
}

export const COMMON_PROTOCOLS: ProtocolOption[] = [
  { label: 'Merchant Moe', address: '0x0000000000000000000000000000000000000001' },
  { label: 'Agni Finance', address: '0x0000000000000000000000000000000000000002' },
  { label: 'FusionX', address: '0x0000000000000000000000000000000000000003' },
];

export const PROTOCOL_LABELS: string[] = COMMON_PROTOCOLS.map((p) => p.label);

export const addressForProtocol = (label: string): string | undefined =>
  COMMON_PROTOCOLS.find((p) => p.label.toLowerCase() === label.toLowerCase())?.address;
