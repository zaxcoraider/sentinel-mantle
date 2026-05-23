import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Address, Hex } from 'viem';

export interface SafetyRulesForm {
  maxDrawdownBps: number;       // e.g. 1000 = 10%
  maxTxPerHour: number;         // e.g. 50
  oracleDeviationBps: number;   // e.g. 500 = 5%
  dailyVolumeCapUsd: number;    // e.g. 10000 (USD)
  timeOfDayMin: number;         // 0-23
  timeOfDayMax: number;         // 0-23
  allowedProtocols: string[];   // protocol addresses as hex strings
}

export interface DepositForm {
  token: string;   // 'NATIVE' or ERC-20 address
  amount: string;  // human-readable string, empty = skip deposit
}

export interface OnboardState {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  selectedTokenId?: string;   // bigint serialised as string (zustand/persist can't handle bigint)
  selectedAgent?: Address;
  registrationURI?: string;
  rules: SafetyRulesForm;
  deposit: DepositForm;
  deployedRulesAddress?: Address;
  registeredTxHash?: Hex;
  // actions
  setStep: (s: 1 | 2 | 3 | 4 | 5 | 6) => void;
  setAgent: (tokenId: bigint, agent: Address, uri?: string) => void;
  patchRules: (patch: Partial<SafetyRulesForm>) => void;
  setDeposit: (d: DepositForm) => void;
  setDeployedRules: (addr: Address) => void;
  setRegisteredTx: (hash: Hex) => void;
  reset: () => void;
}

const DEFAULT_RULES: SafetyRulesForm = {
  maxDrawdownBps: 1000,       // 10%
  maxTxPerHour: 50,
  oracleDeviationBps: 500,    // 5%
  dailyVolumeCapUsd: 10000,
  timeOfDayMin: 9,
  timeOfDayMax: 21,
  allowedProtocols: [],
};

const DEFAULT_DEPOSIT: DepositForm = { token: 'NATIVE', amount: '' };

export const useOnboardStore = create<OnboardState>()(
  persist(
    (set) => ({
      step: 1,
      rules: { ...DEFAULT_RULES },
      deposit: { ...DEFAULT_DEPOSIT },

      setStep: (s) => set({ step: s }),
      setAgent: (tokenId, agent, uri) =>
        set({ selectedTokenId: tokenId.toString(), selectedAgent: agent, registrationURI: uri }),
      patchRules: (patch) =>
        set((s) => ({ rules: { ...s.rules, ...patch } })),
      setDeposit: (d) => set({ deposit: d }),
      setDeployedRules: (addr) => set({ deployedRulesAddress: addr }),
      setRegisteredTx: (hash) => set({ registeredTxHash: hash }),
      reset: () =>
        set({
          step: 1,
          selectedTokenId: undefined,
          selectedAgent: undefined,
          registrationURI: undefined,
          rules: { ...DEFAULT_RULES },
          deposit: { ...DEFAULT_DEPOSIT },
          deployedRulesAddress: undefined,
          registeredTxHash: undefined,
        }),
    }),
    { name: 'sentinel-onboard' },
  ),
);
