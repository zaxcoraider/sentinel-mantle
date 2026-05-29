# Sentinel — Agent Circuit Breaker for Mantle

> Auto-pause and rescue funds when your AI agent misbehaves.

Built for the **Mantle Turing Test Hackathon 2026** — AI DevTools, AI x RWA, and Agentic Economy tracks.

**Live app:** [agentsentinel.vercel.app](https://agentsentinel.vercel.app)

## What it does

Autonomous AI agents can lose everything overnight — a bad trade, a manipulated
oracle, a runaway loop. Sentinel is the circuit breaker that stops it.

A human wraps their ERC-8004 agent into Sentinel, configures safety rules, and
deposits the agent's operating capital into a custody vault. The agent operates
*through* the vault. An off-chain monitor watches every agent and, on a critical
anomaly, freezes that agent on-chain. The human then moves the frozen funds into
a timelocked emergency vault.

**No role in Sentinel can move a user's funds except that user.** The monitor can
only *freeze* — never transfer.

## Architecture

```
SafetyRules        per-agent rule config + evaluator (drawdown, tx-rate,
                   allowlist, oracle deviation, volume, time window)
AgentRegistry      ERC-8004 <-> Sentinel bridge; resolves agent ownership
ReputationOracle   on-chain agent scoreboard [0..1000]
EmergencyVault     timelocked, segregated holding for rescued funds
SentinelGuard      custody vault + per-agent circuit breaker
```

Two-layer defense: cheap rules are enforced **on-chain** before an agent action
executes; value-based anomalies (drawdown, oracle deviation, volume) are detected
**off-chain** by the monitor, which trips the breaker. See
[`docs/CONTRACT_ARCHITECTURE.md`](docs/CONTRACT_ARCHITECTURE.md) and
[`monitor/ARCHITECTURE.md`](monitor/ARCHITECTURE.md).

## Status

| Phase | Status |
|---|---|
| 1 — Foundation & skeleton deploy | **Done** |
| 2 — Full contract suite | **Done** — 5 contracts, 180/180 tests, 100% coverage |
| 3 — Off-chain monitor | **Done** — 49 vitest tests, anomaly engine + Pyth + SSE + health |
| 4 — Frontend dashboard | **Done** — 6 pages, deployed to Vercel |
| 5.1 — Demo agents | **Done** — 3 victim agents, setup/reset/manual-trigger scripts |
| 5.2 — Mainnet deploy | Pending |
| 6 — Polish + submission | Pending |

## Live contracts (Mantle Sepolia, chain 5003)

| Contract | Address |
|---|---|
| SentinelGuard | [`0x929EC63c…6eCF22642`](https://explorer.sepolia.mantle.xyz/address/0x929EC63c07A0d34358DF34ac073F2bf6eCF22642) |
| AgentRegistry | [`0x5c570A7C…6DF549356`](https://explorer.sepolia.mantle.xyz/address/0x5c570A7C3De89bd4E27df65D6aFafD66DF549356) |
| ReputationOracle | [`0x2688B012…fF1463a7f`](https://explorer.sepolia.mantle.xyz/address/0x2688B0125E22fDAE168fb3B3B7635A8fF1463a7f) |
| EmergencyVault | [`0x7A1E8Ea5…2Ce3cCe5`](https://explorer.sepolia.mantle.xyz/address/0x7A1E8Ea5a054879dE96C01973b3D67ad2Ce3cCe5) |
| MockIdentityRegistry | [`0xbbb12950…1be8CA91`](https://explorer.sepolia.mantle.xyz/address/0xbbb129508fdCCB59334432c5C3d6b4251be8CA91) |

Deployer wallet: `0xDb45be03…ae929828f4` · Monitor wallet: `0x92e86524…F370Adfb6`

Mainnet deploy targeted at Phase 5.2; addresses will be added here once live.

## Stack

- **Contracts:** Solidity 0.8.24 + Foundry on Mantle Network
- **Monitor:** Node.js 20+ + TypeScript (strict) + viem + native `node:sqlite`
- **Frontend:** Next.js 14 + Tailwind + wagmi + RainbowKit + shadcn/ui
- **Demo agents:** TypeScript + viem (no ethers) + node-cron + chalk/boxen

## Repo layout

```
contracts/        Foundry project — 5 contracts, 180 tests, deployment scripts
monitor/          off-chain anomaly engine + SSE event hub
web/              Next.js 14 frontend (landing, onboard, watch, dashboard, agent, leaderboard)
demo-agents/      3 victim agents that intentionally fail so Sentinel saves them
docs/             contract + UI design docs, brand assets
```

## Quick start

```bash
# Install everything
pnpm install

# Contracts
cd contracts
forge build
forge test -vvv
forge coverage --no-match-coverage "test/"

# Monitor (vs. Sepolia)
cd monitor
cp ../.env.example .env   # fill in MONITOR_PRIVATE_KEY + RPC
pnpm dev                  # serves /health, /events (SSE), /agents on :8080

# Web (local dev)
cd web
pnpm dev                  # http://localhost:3000
# Point at local monitor with NEXT_PUBLIC_MONITOR_URL=http://localhost:8080

# Demo agents (Sepolia dry-run)
cd demo-agents
cp .env.example .env      # fill DEPLOYER_PRIVATE_KEY + MONITOR_PRIVATE_KEY
pnpm setup                # mint 3 NFTs + deploy 3 SafetyRules + register + fund
pnpm agents:start         # spawn YieldChaser / ProtocolHopper / Insomniac
pnpm manual:trigger yieldchaser MAX_DRAWDOWN   # fire breaker for the demo
```

## Mantle-specific notes

- Gas token is **MNT**, not ETH. Frontends should use `eth_estimateL1Fee` for total tx cost (L2 execution + L1 data fee, like Optimism).
- Mantle DA (EigenDA) makes calldata cheap, but events are still costly — keep `indexed` topics tight.
- Mainnet uses a 7-day optimistic withdrawal challenge — don't build flows assuming fast L2→L1 exits.
- `mETH` rebases (native staking yield); guarded balances grow over time — anomaly detectors must subtract reference yield before flagging drawdown.

## License

MIT
