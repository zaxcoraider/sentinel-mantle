// Monitor configuration. Reads the project-root .env (Node built-in env loader)
// and the on-chain deployment addresses from contracts/deployments/<network>.json.
// Addresses come from the deployment file, never hardcoded.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, type Address, type Hex } from "viem";

const HERE = dirname(fileURLToPath(import.meta.url));
// monitor/src (or monitor/dist) -> monitor -> project root
export const PROJECT_ROOT = join(HERE, "..", "..");

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

interface DeploymentFile {
  network: string;
  chainId: number;
  monitor: string;
  contracts: {
    AgentRegistry: { address: string };
    SentinelGuard: { address: string };
    ReputationOracle: { address: string };
    EmergencyVault: { address: string };
  };
}

export interface MonitorAddresses {
  agentRegistry: Address;
  sentinelGuard: Address;
  reputationOracle: Address;
  emergencyVault: Address;
}

export interface DexPool {
  name: string;
  address: Address;
}

export interface MonitorConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  fallbackRpcUrl: string;
  addresses: MonitorAddresses;
  /** The monitor wallet the deployed SentinelGuard authorizes to pause. */
  monitorExpected: Address;
  /** Hot-wallet key — only needed by the trigger pipeline (Phase 3.4). */
  monitorPrivateKey?: Hex;
  pythEndpoint: string;
  alertWebhookUrl?: string;
  /** DEX pools to watch for Swap events. Config-driven — never hardcoded. */
  dexPools: DexPool[];
  dbPath: string;
  healthPort: number;
}

const ZERO_KEY = `0x${"0".repeat(64)}`;
const PK_RE = /^0x[0-9a-fA-F]{64}$/;

const loadEnv = (): void => {
  try {
    process.loadEnvFile(join(PROJECT_ROOT, ".env"));
  } catch {
    // .env is optional — production may inject vars via the platform.
  }
};

const required = (name: string): string => {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new ConfigError(`Missing required env var: ${name}`);
  }
  return v;
};

const loadDeployment = (network: string): DeploymentFile => {
  const path = join(PROJECT_ROOT, "contracts", "deployments", `${network}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as DeploymentFile;
  } catch (err) {
    throw new ConfigError(
      `Could not read deployment file ${path}: ${(err as Error).message}`,
    );
  }
};

// Parse "MerchantMoe:0xabc...,Agni:0xdef..." into a list of named pools.
const parseDexPools = (raw: string | undefined): DexPool[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [name, addr] = entry.split(":").map((s) => s.trim());
      if (!name || !addr) {
        throw new ConfigError(`Invalid DEX_POOLS entry: "${entry}" (want name:0xaddress)`);
      }
      return { name, address: getAddress(addr) };
    });
};

const parsePrivateKey = (raw: string | undefined): Hex | undefined => {
  if (raw === undefined || raw === "" || raw === ZERO_KEY) return undefined;
  if (!PK_RE.test(raw)) {
    throw new ConfigError("MONITOR_PRIVATE_KEY is set but is not a 32-byte hex key");
  }
  return raw as Hex;
};

export const loadConfig = (network = "sepolia"): MonitorConfig => {
  loadEnv();
  const deployment = loadDeployment(network);
  const isMainnet = deployment.chainId === 5000;

  const rpcUrl = isMainnet
    ? required("MANTLE_RPC_URL")
    : required("MANTLE_SEPOLIA_RPC_URL");
  // Network-aware fallback. MANTLE_RPC_FALLBACK is a mainnet endpoint, so it must
  // not be used on Sepolia (wrong chain). Default to the primary when no
  // network-correct fallback is configured.
  const fallbackRpcUrl = isMainnet
    ? (process.env.MANTLE_RPC_FALLBACK ?? rpcUrl)
    : (process.env.MANTLE_SEPOLIA_RPC_FALLBACK ?? rpcUrl);

  return {
    network: deployment.network,
    chainId: deployment.chainId,
    rpcUrl,
    fallbackRpcUrl,
    addresses: {
      agentRegistry: getAddress(deployment.contracts.AgentRegistry.address),
      sentinelGuard: getAddress(deployment.contracts.SentinelGuard.address),
      reputationOracle: getAddress(deployment.contracts.ReputationOracle.address),
      emergencyVault: getAddress(deployment.contracts.EmergencyVault.address),
    },
    monitorExpected: getAddress(deployment.monitor),
    monitorPrivateKey: parsePrivateKey(process.env.MONITOR_PRIVATE_KEY),
    pythEndpoint: process.env.PYTH_ENDPOINT ?? "https://hermes.pyth.network",
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || undefined,
    dexPools: parseDexPools(process.env.DEX_POOLS),
    dbPath: join(PROJECT_ROOT, "monitor", "data", "agents.db"),
    healthPort: Number(process.env.MONITOR_HEALTH_PORT ?? 8080),
  };
};
