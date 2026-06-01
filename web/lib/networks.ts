// Both Mantle networks as a registry. Server- and client-safe (only static
// imports + NEXT_PUBLIC_* env). The active network is chosen at runtime via a
// cookie (server) / the same cookie read on the client — see useClientNet +
// the NetworkToggle in the nav.
import type { Address, Chain } from 'viem';
import { mantleMainnet, mantleSepolia } from './chains';
import { DEPLOYMENTS } from './contracts';

export type NetKey = 'mainnet' | 'sepolia';

export interface NetConfig {
  key: NetKey;
  label: string;
  short: string;
  chainId: number;
  chain: Chain;
  deployments: {
    AgentRegistry: Address;
    SentinelGuard: Address;
    ReputationOracle: Address;
    EmergencyVault: Address;
    AgentIdentityRegistry: Address;
  };
  explorerBase: string;
  deployBlock: bigint;
  primaryRpc: string;
  fallbackRpc: string;
}

export const NETWORKS: Record<NetKey, NetConfig> = {
  mainnet: {
    key: 'mainnet',
    label: 'Mantle Mainnet',
    short: 'Mainnet',
    chainId: 5000,
    chain: mantleMainnet,
    deployments: DEPLOYMENTS.mainnet,
    explorerBase: DEPLOYMENTS.mainnet.explorerBase,
    deployBlock: 96_051_249n,
    primaryRpc: process.env.NEXT_PUBLIC_MANTLE_RPC_URL ?? 'https://rpc.mantle.xyz',
    fallbackRpc: 'https://mantle.drpc.org',
  },
  sepolia: {
    key: 'sepolia',
    label: 'Mantle Sepolia',
    short: 'Sepolia',
    chainId: 5003,
    chain: mantleSepolia,
    deployments: DEPLOYMENTS.sepolia,
    explorerBase: DEPLOYMENTS.sepolia.explorerBase,
    deployBlock: 39_000_000n,
    primaryRpc: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.mantle.xyz',
    fallbackRpc: 'https://mantle-sepolia.drpc.org',
  },
};

export const NET_KEYS: NetKey[] = ['mainnet', 'sepolia'];
export const NET_COOKIE = 'sentinel-net';

// Default network when no cookie is set. Honors NEXT_PUBLIC_CHAIN_ID for parity
// with how the app was previously pinned.
export const DEFAULT_NET: NetKey =
  process.env.NEXT_PUBLIC_CHAIN_ID === '5003' ? 'sepolia' : 'mainnet';

export const toNetKey = (v: string | undefined | null): NetKey =>
  v === 'sepolia' || v === 'mainnet' ? v : DEFAULT_NET;

export const netForChainId = (id: number | undefined): NetKey =>
  id === 5003 ? 'sepolia' : 'mainnet';
