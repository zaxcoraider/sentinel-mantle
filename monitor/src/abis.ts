// Event ABI fragments for the contracts the monitor watches.
//
// Hand-written (not generated from contracts/out, which is gitignored) and kept
// minimal: only the events the listener subscribes to. Signatures are copied
// verbatim from the deployed contracts — keep them in sync with:
//   contracts/src/AgentRegistry.sol
//   contracts/src/SentinelGuard.sol
//
// `as const` gives viem full type inference on decoded log args.

export const agentRegistryEvents = [
  {
    type: "event",
    name: "AgentGuarded",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "rulesContract", type: "address", indexed: false },
      { name: "guardContract", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgentDeregistered",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

export const sentinelGuardEvents = [
  {
    type: "event",
    name: "AgentExecuted",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
      { name: "selector", type: "bytes4", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "from", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "CircuitBreakerTriggered",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "reason", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

// SafetyRules: scalar rule getters (read by RulesCache) + the allowlist event
// (folded to reconstruct the current allowed-protocol set, since the on-chain
// mapping isn't enumerable). Keep in sync with contracts/src/SafetyRules.sol.
export const safetyRulesAbi = [
  { type: "function", name: "maxDrawdownBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxTxPerHour", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "oracleDeviationBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "dailyVolumeCapUsd", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "timeOfDayMin", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "timeOfDayMax", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "allowedProtocols",
    stateMutability: "view",
    inputs: [{ name: "protocol", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "ProtocolAllowlistChanged",
    inputs: [
      { name: "protocol", type: "address", indexed: true },
      { name: "allowed", type: "bool", indexed: false },
    ],
  },
] as const;

// Generic Uniswap-V2-style Swap event — Merchant Moe, and most Mantle AMMs, are
// V2 forks. Used to detect agent trading activity / implied price off-chain.
// DEX pool addresses are config-driven (never hardcoded) — see config.dexPools.
export const dexV2SwapEvent = [
  {
    type: "event",
    name: "Swap",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "amount0In", type: "uint256", indexed: false },
      { name: "amount1In", type: "uint256", indexed: false },
      { name: "amount0Out", type: "uint256", indexed: false },
      { name: "amount1Out", type: "uint256", indexed: false },
      { name: "to", type: "address", indexed: true },
    ],
  },
] as const;
