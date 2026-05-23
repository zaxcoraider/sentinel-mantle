// Maps on-chain custom-error names to user-friendly messages.
// Never show raw revert strings in the UI.

const ERROR_MESSAGES: Record<string, string> = {
  NotMonitor: 'Only the Sentinel monitor can perform this action.',
  NotAgentOwner: 'Only the agent owner can perform this action.',
  AgentNotGuarded: 'This agent is not registered with Sentinel.',
  AgentIsPaused: 'This agent is currently paused.',
  AgentNotPaused: 'This agent is not paused.',
  CooldownActive: 'Cooling down — please wait before retrying.',
  RuleCheckFailed: 'A safety rule check failed.',
  ProtocolCallFailed: 'The protocol call failed.',
  InsufficientBalance: 'Insufficient balance in the guard.',
  ZeroAddress: 'Invalid address provided.',
  ZeroAmount: 'Amount must be greater than zero.',
  NotTokenOwner: 'You do not own this ERC-8004 identity.',
  AlreadyRegistered: 'This agent is already registered.',
  NotRegistered: 'This agent is not registered.',
  UserRejectedRequest: 'Transaction rejected.',
  ConnectorNotConnected: 'Wallet not connected.',
};

export const friendlyError = (err: unknown): string => {
  if (!err) return 'An unknown error occurred.';
  const msg = err instanceof Error ? err.message : String(err);

  for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(key)) return friendly;
  }

  // CooldownActive carries a timestamp
  const cooldown = msg.match(/CooldownActive.*?(\d+)/);
  if (cooldown) {
    const secs = Math.max(0, Math.ceil((Number(cooldown[1]) * 1000 - Date.now()) / 1000));
    return `Cooling down — try again in ${secs}s.`;
  }

  if (msg.toLowerCase().includes('user rejected')) return 'Transaction rejected.';

  return 'Transaction failed. Check the explorer for details.';
};
