// Shared utilities for demo agents: viem clients, deployment addresses,
// EOA key generation/loading, story-log helpers (chalk + boxen).

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { mantle, mantleSepoliaTestnet } from 'viem/chains';
import chalk from 'chalk';
import boxen from 'boxen';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT = resolve(__dirname, '..');
export const KEYS_PATH = resolve(ROOT, '.agent-keys.json');
export const CONFIG_PATH = resolve(ROOT, 'agent-config.json');

// ── Network selection ─────────────────────────────────────────────────────
// DEMO_NETWORK=mainnet (default) | sepolia. Drives chain, RPC, and which
// deployed suite the demo agents act on.
const NET = (process.env.DEMO_NETWORK ?? 'mainnet').toLowerCase();
export const IS_MAINNET = NET !== 'sepolia';
export const CHAIN = IS_MAINNET ? mantle : mantleSepoliaTestnet;
export const CHAIN_ID = CHAIN.id;
export const NETWORK_NAME = IS_MAINNET ? 'mantle-mainnet' : 'mantle-sepolia';

// Deployed suites. NOTE: the identity registry key stays `MockIdentityRegistry`
// for code compatibility, but on mainnet it points at AgentIdentityRegistry
// (identical ABI, "Mock" dropped — see contracts/deployments/mainnet.json).
const MAINNET_DEPLOYMENTS = {
  ReputationOracle: '0x2688B0125E22fDAE168fb3B3B7635A8fF1463a7f' as Address,
  EmergencyVault: '0x7A1E8Ea5a054879dE96C01973b3D67ad2Ce3cCe5' as Address,
  AgentRegistry: '0x5c570A7C3De89bd4E27df65D6aFafD66DF549356' as Address,
  SentinelGuard: '0x929EC63c07A0d34358DF34ac073F2bf6eCF22642' as Address,
  MockIdentityRegistry: '0xbbb129508fdCCB59334432c5C3d6b4251be8CA91' as Address,
} as const;

const SEPOLIA_DEPLOYMENTS = {
  ReputationOracle: '0x3C2Dc550df5c8F497083C89Ad0F1Bd96942113CC' as Address,
  EmergencyVault: '0x418BA815CeaE1f4D3CE06E0190b6546647DD9865' as Address,
  AgentRegistry: '0xF09f811397cbd9dE54a8505f22D4A276A2ED5c41' as Address,
  SentinelGuard: '0xf4bB2b95414A1fE100310e85FD24e12e88Be0ba7' as Address,
  MockIdentityRegistry: '0x4DDd7464d6159Cf37f21e9B1ccd074AD8a532432' as Address,
} as const;

export const DEPLOYMENTS = IS_MAINNET ? MAINNET_DEPLOYMENTS : SEPOLIA_DEPLOYMENTS;

export const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000' as Address;

// ── viem clients ────────────────────────────────────────────────────────────

export const RPC_URL = IS_MAINNET
  ? process.env.MANTLE_RPC_URL ?? 'https://rpc.mantle.xyz'
  : process.env.MANTLE_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.mantle.xyz';

export const publicClient: PublicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

export const walletFromKey = (key: Hex): { account: Account; client: WalletClient } => {
  const account = privateKeyToAccount(key);
  const client = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });
  return { account, client };
};

// ── Env-derived wallets ─────────────────────────────────────────────────────

export const getDeployerKey = (): Hex => {
  const k = process.env.DEPLOYER_PRIVATE_KEY;
  if (!k || !k.startsWith('0x')) {
    throw new Error('DEPLOYER_PRIVATE_KEY missing or malformed — see demo-agents/.env.example');
  }
  return k as Hex;
};

export const getMonitorKey = (): Hex => {
  const k = process.env.MONITOR_PRIVATE_KEY;
  if (!k || !k.startsWith('0x')) {
    throw new Error('MONITOR_PRIVATE_KEY missing or malformed — see demo-agents/.env.example');
  }
  return k as Hex;
};

// ── Agent key storage ───────────────────────────────────────────────────────

export type AgentName = 'yieldchaser' | 'protocolhopper' | 'insomniac';
export const AGENT_NAMES: readonly AgentName[] = ['yieldchaser', 'protocolhopper', 'insomniac'];

export interface AgentKeys {
  yieldchaser: Hex;
  protocolhopper: Hex;
  insomniac: Hex;
}

export const loadOrCreateKeys = (): AgentKeys => {
  if (existsSync(KEYS_PATH)) {
    return JSON.parse(readFileSync(KEYS_PATH, 'utf-8')) as AgentKeys;
  }
  const keys: AgentKeys = {
    yieldchaser: generatePrivateKey(),
    protocolhopper: generatePrivateKey(),
    insomniac: generatePrivateKey(),
  };
  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));
  return keys;
};

export const loadKeys = (): AgentKeys => {
  if (!existsSync(KEYS_PATH)) {
    throw new Error('.agent-keys.json missing — run `pnpm setup` first');
  }
  return JSON.parse(readFileSync(KEYS_PATH, 'utf-8')) as AgentKeys;
};

// ── Agent config (post-setup) ───────────────────────────────────────────────

export interface AgentRecord {
  address: Address;
  tokenId: string;          // bigint serialized
  rulesContract: Address;
  registeredAt: number;     // unix seconds
  fundedMnt: string;        // wei serialized
}

export interface AgentConfig {
  network: string;
  chainId: number;
  setupAt: number;
  yieldchaser: AgentRecord;
  protocolhopper: AgentRecord;
  insomniac: AgentRecord;
}

export const loadConfig = (): AgentConfig => {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error('agent-config.json missing — run `pnpm setup` first');
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as AgentConfig;
};

export const saveConfig = (cfg: AgentConfig): void => {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
};

// ── Story-log helpers ───────────────────────────────────────────────────────

const PALETTE = {
  yieldchaser: chalk.cyan,
  protocolhopper: chalk.magenta,
  insomniac: chalk.yellow,
} as const;

export const banner = (name: AgentName, address: Address): string =>
  boxen(
    [
      PALETTE[name].bold(name.toUpperCase()),
      chalk.gray(address),
      chalk.gray(`${NETWORK_NAME} · ${new Date().toISOString()}`),
    ].join('\n'),
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'gray',
      align: 'left',
    },
  );

export const story = (name: AgentName, msg: string): void => {
  const tag = PALETTE[name](`[${name}]`);
  console.log(`${chalk.gray(new Date().toISOString().slice(11, 19))} ${tag} ${msg}`);
};

export const ok = (name: AgentName, msg: string): void => {
  story(name, chalk.green('✓ ') + msg);
};

export const warn = (name: AgentName, msg: string): void => {
  story(name, chalk.yellow('⚠ ') + msg);
};

export const fail = (name: AgentName, msg: string): void => {
  story(name, chalk.red('✗ ') + msg);
};

// ── viem error helpers ──────────────────────────────────────────────────────

export const friendlyRevert = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('RuleCheckFailed')) {
    const m = msg.match(/RuleCheckFailed\((0x[0-9a-fA-F]{64})/);
    return m ? `RuleCheckFailed(${m[1].slice(0, 10)}…)` : 'RuleCheckFailed';
  }
  if (msg.includes('AgentIsPaused')) return 'AgentIsPaused (circuit breaker tripped)';
  if (msg.includes('InsufficientBalance')) return 'InsufficientBalance';
  if (msg.includes('AgentNotGuarded')) return 'AgentNotGuarded';
  return msg.split('\n')[0].slice(0, 160);
};
