# Sentinel — Agent Circuit Breaker for Mantle

> Auto-pause and rescue funds when your AI agent misbehaves.

Built for the **Mantle Turing Test Hackathon 2026** — AI DevTools, AI x RWA, and Agentic Economy tracks.

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
[`docs/CONTRACT_ARCHITECTURE.md`](docs/CONTRACT_ARCHITECTURE.md).

## Status

| Phase | Status |
|---|---|
| 1 — Foundation & skeleton deploy | Done |
| 2 — Full contract suite | **Done** — 5 contracts, 180 tests, 100% coverage |
| 3 — Off-chain monitor | In progress |
| 4 — Frontend dashboard | Planned |
| 5 — Demo agents + mainnet | Planned |
| 6 — Polish + submission | Planned |

## Live contracts

| Contract | Network | Address |
|---|---|---|
| SentinelGuard (Phase 1 skeleton) | Mantle Sepolia | [`0x586448d1…6cA46c0d`](https://explorer.sepolia.mantle.xyz/address/0x586448d146BcDD7FBb1F3dd8c3E7e0506cA46c0d) |

> The full Phase 2 suite is built and tested; a fresh deployment of all five
> contracts is pending.

## Stack

- **Contracts:** Solidity 0.8.24 + Foundry on Mantle Network
- **Monitor:** Node.js 20 + TypeScript + viem
- **Frontend:** Next.js 14 + Tailwind + wagmi + RainbowKit

## Quick start

```bash
# Contracts
cd contracts
forge build
forge test -vvv
forge coverage --no-match-coverage "test/"

# Deploy the full suite (reads PRIVATE_KEY, MONITOR_ADDRESS from .env)
forge script script/Deploy.s.sol --rpc-url mantle_sepolia --broadcast
```

## License

MIT
