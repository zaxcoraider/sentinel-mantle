# Sentinel — Project Conventions for Claude Code

> Read this file BEFORE making any changes. It defines how this project is built.

## What Sentinel is

Sentinel is a circuit breaker protocol for autonomous AI agents on Mantle Network. Users wrap their ERC-8004 agents into Sentinel, configure safety rules (drawdown limits, allowed protocols, rate caps, oracle deviation), and an off-chain monitor auto-pauses + rescues funds if the agent misbehaves.

Built for the Mantle Turing Test Hackathon 2026. Tracks: AI DevTools, AI x RWA, Agentic Economy.

## Stack

- **Contracts:** Solidity 0.8.24 + Foundry. No Hardhat anywhere.
- **Monitor:** Node.js 20 + TypeScript (strict mode) + viem. Do NOT use ethers v6 in new code.
- **Frontend:** Next.js 14 (app router) + TypeScript + Tailwind + shadcn/ui + wagmi + RainbowKit.
- **Database:** better-sqlite3 for the monitor's local state. No external DBs.
- **Package manager:** pnpm. Workspaces enabled.

## Chain configuration

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Mantle Mainnet | 5000 | https://rpc.mantle.xyz | https://mantlescan.xyz |
| Mantle Sepolia | 5003 | https://rpc.sepolia.mantle.xyz | https://explorer.sepolia.mantle.xyz |

**Gas token is MNT, not ETH.** Update gas estimation logic accordingly.
L1 fee component exists (like Optimism). Use `eth_estimateL1Fee` when relevant.

## Code conventions

### Solidity

- Custom errors only. No `require("string")` reverts.
- Every external function uses ReentrancyGuard if it touches state or transfers tokens.
- All ERC-20 transfers go through SafeERC20.
- NatSpec on every external/public function: `@notice`, `@param`, `@return`.
- Events on every state-changing function.
- Named imports: `import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";` — never wildcard imports.
- Immutable variables for constructor-set addresses.
- No upgradeability proxies in v1. Deploy fresh contracts for breaking changes.

### TypeScript

- `strict: true` in tsconfig. No `any`. No `as unknown as`.
- Use `viem` types directly (`Address`, `Hex`, etc.) instead of `string`.
- Prefer `const` over `let`. Prefer arrow functions.
- Async/await, never `.then()` chains.
- Errors are thrown as typed Error subclasses, not strings.

### Next.js / React

- Server Components by default. Add `"use client"` only when needed (hooks, wallet, browser APIs).
- Components in `web/components/` are pure. Pages compose them.
- No CSS modules. Tailwind only. shadcn/ui for primitives.
- No state libraries other than zustand (if you need global state at all).

### File naming

- Solidity: `PascalCase.sol` for contracts, `IPascalCase.sol` for interfaces.
- TypeScript: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.
- Tests live next to the file: `Foo.sol` ↔ `Foo.t.sol`, `bar.ts` ↔ `bar.test.ts`.

## Required environment variables

Copy `.env.example` to `.env` and fill in. NEVER commit `.env`.

```bash
PRIVATE_KEY=0x...                    # Deployer wallet (fresh, not your main)
MONITOR_PRIVATE_KEY=0x...            # Monitor's hot wallet (separate from deployer)
MANTLE_RPC_URL=https://rpc.mantle.xyz
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
MANTLE_RPC_FALLBACK=https://mantle.drpc.org
MANTLESCAN_API_KEY=...
PYTH_ENDPOINT=https://hermes.pyth.network
ALERT_WEBHOOK_URL=...                # Optional, for Discord/Slack
ANTHROPIC_API_KEY=...                # For demo agents' reasoning output
```

## Hard rules — do not break these

1. **Never deploy without tests passing.** Run `pnpm test` across all packages first.
2. **Never commit private keys.** Check `.gitignore` covers `.env` before every commit.
3. **Never use string reverts in Solidity.** Custom errors only.
4. **Never use `any` in TypeScript.** If type-narrowing is hard, ask before resorting to `unknown`.
5. **Never hardcode RPC URLs in code.** Always env vars.
6. **Never call `triggerCircuitBreaker` from anything except the monitor wallet.** Access control is the security perimeter.
7. **Never let the monitor wallet hold user funds.** It can pause and emit events — that's all.
8. **Never trust off-chain price data without on-chain verification.** Sanity-check Pyth prices against last on-chain swap.

## Build order (when starting fresh)

1. Read `docs/CONTRACT_ARCHITECTURE.md`.
2. Build & test contracts: `SafetyRules` → `ReputationOracle` → `AgentRegistry` → `SentinelGuard`.
3. Deploy to Sepolia, save addresses to `contracts/deployments/sepolia.json`.
4. Generate ABIs into `web/lib/contracts.ts` via `pnpm gen:abis`.
5. Build monitor against Sepolia, run for 30 minutes minimum, confirm no crashes.
6. Build frontend pages: landing → onboard → watch → dashboard → leaderboard.
7. Build demo agents + setup script.
8. End-to-end test on Sepolia.
9. Mainnet deploy.
10. Polish + submit.

## Useful commands

```bash
# Contracts
cd contracts
forge install                       # First time only
forge build                         # Compile
forge test -vvv                     # Verbose tests
forge coverage                      # Coverage report
forge fmt                           # Format
slither src --exclude-dependencies  # Static analysis

# Monitor
cd monitor
pnpm dev                            # Watch mode
pnpm test                           # Vitest
pnpm monitor:debug --agent=0x...    # Simulate anomaly

# Web
cd web
pnpm dev                            # Local at :3000
pnpm build                          # Production build
pnpm gen:abis                       # Regenerate contract ABIs

# Demo agents
cd demo-agents
pnpm setup                          # Mint identities + register agents
pnpm agents:start                   # Start all 3 victim agents
pnpm agents:reset                   # Reset for repeated demos

# Whole monorepo
pnpm -r test                        # Tests in all packages
pnpm -r build                       # Build all packages
```

## Mantle-specific gotchas

- **L1 fee component:** Total tx cost = L2 execution fee + L1 data fee. Frontends must use `eth_estimateL1Fee` or users will under-estimate.
- **Mantle DA (EigenDA):** Don't assume Ethereum calldata cost models. Calldata is cheaper here. But emit events sparingly anyway.
- **7-day withdrawal period:** Mantle Mainnet uses optimistic challenge. Don't build flows that assume fast L2→L1 withdrawals.
- **Centralized sequencer:** No MEV protection currently. Don't rely on tx ordering for security-critical logic.
- **mETH staking yield:** Native mETH accrues yield by rebasing. If guarding mETH, account for balance growth — don't flag it as anomalous drawdown.

## Reference links

- Mantle docs: https://docs.mantle.xyz/network
- Mantle GitHub: https://github.com/mantlenetworkio
- ERC-8004 contracts: https://github.com/mantlenetworkio/erc-8004-contracts
- Mantlescan API: https://api.mantlescan.xyz/api
- Pyth price feeds: https://pyth.network/developers/price-feed-ids

## Token addresses (Mantle Mainnet)

```
MNT       0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8
mETH      0xcDA86A272531e8640cD7F1a92c01839911B90bb0
USDY      0x5bE26527e817998A7206475496fDE1E68957c5A6
USDe      0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34
```

Always verify against official Mantle docs before using in production.

## When you hit a problem

1. Re-read this file. Most "weird behavior" comes from violating a convention here.
2. Check `docs/`. Architecture decisions are documented there.
3. Check `contracts/deployments/{chain}.json`. Wrong address = wrong network.
4. Ask before workarounds. Don't add hacky fixes that violate hard rules.
