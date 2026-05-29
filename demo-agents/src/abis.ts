// Minimal ABI subset used by demo agents. If contracts change, regenerate from
// contracts/out/<Name>.sol/<Name>.json or copy from web/lib/contracts.ts.

export const MockIdentityRegistryAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'agentAddress', type: 'address' },
      { name: 'registrationURI', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const AgentRegistryAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'erc8004TokenId', type: 'uint256' },
      { name: 'rulesContract', type: 'address' },
      { name: 'guardContract', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isGuarded',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: 'guarded', type: 'bool' }],
  },
] as const;

export const SentinelGuardAbi = [
  {
    type: 'function',
    name: 'depositNativeForAgent',
    stateMutability: 'payable',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeAsAgent',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: 'result', type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'isPaused',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: 'paused', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'triggerCircuitBreaker',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'reason', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'rescueToSafety',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
  },
] as const;

export const SafetyRulesAbi = [
  {
    type: 'function',
    name: 'setProtocolAllowed',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'protocol', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'allowProtocolsBatch',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'protocols', type: 'address[]' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'allowedProtocols',
    stateMutability: 'view',
    inputs: [{ name: 'protocol', type: 'address' }],
    outputs: [{ name: 'allowed', type: 'bool' }],
  },
] as const;
