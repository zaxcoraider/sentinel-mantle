// Central network selection — server- and client-safe (only reads NEXT_PUBLIC_* env
// + static imports). Drives which deployment the whole app reads from.
import { DEPLOYMENTS } from './contracts';
import { mantleMainnet, mantleSepolia } from './chains';

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '5000');
export const IS_MAINNET = CHAIN_ID !== 5003;

export const NETWORK = IS_MAINNET ? DEPLOYMENTS.mainnet : DEPLOYMENTS.sepolia;
export const ACTIVE_CHAIN = IS_MAINNET ? mantleMainnet : mantleSepolia;
export const EXPLORER_BASE = NETWORK.explorerBase;

// First block to scan for this suite's events — events cannot predate deployment,
// so starting here (instead of block 0) keeps getLogs ranges small and avoids
// the "invalid block range" errors the public RPC throws on full-history scans.
export const DEPLOY_BLOCK = IS_MAINNET ? 96_051_249n : 39_000_000n;

// Primary + fallback RPCs. The public endpoints are load-balanced/flaky, so reads
// use a viem `fallback` transport that fails over to the secondary automatically.
export const PRIMARY_RPC = IS_MAINNET
  ? process.env.NEXT_PUBLIC_MANTLE_RPC_URL ?? 'https://rpc.mantle.xyz'
  : process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.mantle.xyz';
export const FALLBACK_RPC = IS_MAINNET
  ? 'https://mantle.drpc.org'
  : 'https://mantle-sepolia.drpc.org';
