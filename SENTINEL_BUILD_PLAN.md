# SENTINEL — The Agent Circuit Breaker
## Complete Build Plan & Claude Code Prompts

> **Target:** Mantle Turing Test Hackathon 2026 — Phase 2 (AI Awakening)
> **Tracks:** AI DevTools (primary) + AI x RWA + Agentic Economy
> **Prize ceiling:** ~$30,000
> **Build window:** 6 weeks
> **Deadline:** June 16, 2026

---

## Model Strategy

| Model | When to use | Cost/M tokens |
|---|---|---|
| **Opus 4.7** | Architecture, security-critical Solidity, debugging hard bugs, threat modeling, demo video script | $5 in / $25 out |
| **Sonnet 4.6** | DEFAULT — 80% of all coding, refactoring, integration, frontend, TypeScript monitor | $3 in / $15 out |
| **Haiku 4.5** | Boilerplate, deployment scripts, file reads, doc formatting, repetitive edits | cheapest |

**Rule of thumb:** Start every new session with Sonnet 4.6. Switch to Opus 4.7 only when you hit a wall on architecture or security logic. Use Haiku 4.5 for anything mechanical.

**In Claude Code:** Set the model in your config or use `/model` to switch mid-session.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SENTINEL SYSTEM                              │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ Smart Contracts  │    │  Off-chain       │    │  Frontend     │  │
│  │   (Solidity)     │    │  Monitor (TS)    │    │  (Next.js)    │  │
│  │                  │    │                  │    │               │  │
│  │ • SentinelGuard  │◄───┤ • Event listener │◄───┤ • Onboarding  │  │
│  │ • SafetyRules    │    │ • Anomaly engine │    │ • Live status │  │
│  │ • AgentRegistry  │    │ • Trigger pipe   │    │ • Reputation  │  │
│  │ • ReputationOrc. │───►│ • Multi-RPC      │───►│ • Watch mode  │  │
│  │ • EmergencyVault │    │                  │    │               │  │
│  └──────────────────┘    └──────────────────┘    └───────────────┘  │
│           ▲                                              ▲          │
│           └──────────────────┬──────────────────────────┘           │
│                              │                                      │
│                    ┌─────────▼─────────┐                            │
│                    │  Demo Agents      │                            │
│                    │  (intentionally   │                            │
│                    │   fail to show    │                            │
│                    │   Sentinel save)  │                            │
│                    └───────────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — Setup (Day 0, before you write any code)

### Pre-flight checklist
- [ ] Buy domain: `sentinel.guard`, `agentsentinel.xyz`, or similar (~$12)
- [ ] Create GitHub repo (public): `sentinel-mantle`
- [ ] Create X/Twitter account: `@sentinel_guard` or similar
- [ ] Create Discord/Telegram for the project
- [ ] Generate a fresh wallet for testnet deployment (never reuse a real wallet)
- [ ] Get Mantle Sepolia faucet MNT: https://faucet.sepolia.mantle.xyz
- [ ] Sign up for QuickNode or dRPC for mainnet RPC (free tier)
- [ ] Sign up for Mantlescan API key: https://mantlescan.xyz

### Tools you need locally
```bash
node >= 20      # for monitor + frontend
foundry         # for Solidity contracts: curl -L https://foundry.paradigm.xyz | bash
pnpm or bun     # package manager (faster than npm)
git
@anthropic-ai/claude-code   # the agent: npm install -g @anthropic-ai/claude-code
```

---

## Phase 1 — Foundation & Deployment Award Lock (Days 1-3)

**Goal:** Deploy a skeleton contract on Mantle Sepolia, verify it, submit to DoraHacks, lock one of 20 Deployment Award slots ($1,000 guaranteed).

### PROMPT 1.1 — Project scaffold
**Model: Sonnet 4.6**

```
You are setting up a new Foundry + Next.js monorepo for a project called Sentinel — an agent circuit breaker protocol for Mantle Network. Create this exact structure:

sentinel-mantle/
├── contracts/                  # Foundry project
│   ├── src/
│   ├── test/
│   ├── script/
│   └── foundry.toml
├── monitor/                    # TypeScript off-chain monitor
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── web/                        # Next.js 14 app
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
├── demo-agents/                # Example "victim" agents for demos
│   ├── src/
│   └── package.json
├── docs/
├── .gitignore
├── README.md
└── pnpm-workspace.yaml

Requirements:
1. Use pnpm workspaces.
2. Foundry config must include rpc_endpoints for Mantle mainnet (chain 5000) and Mantle Sepolia (chain 5003), and etherscan config for Mantlescan (https://api.mantlescan.xyz/api).
3. Next.js 14 app router, TypeScript, Tailwind CSS, shadcn/ui pre-installed.
4. Monitor uses ethers v6, viem, and ws.
5. Demo-agents uses ethers v6 and node-cron for scheduled "bad behavior."
6. Add an .env.example at the root with all required keys: PRIVATE_KEY, MANTLE_RPC_URL, MANTLE_SEPOLIA_RPC_URL, MANTLESCAN_API_KEY, ANTHROPIC_API_KEY.
7. README should be a placeholder for now — just one line: "SENTINEL — Agent Circuit Breaker for Mantle. Building in public."
8. .gitignore must include .env, node_modules, /out, /cache, /broadcast.

After creating the structure, run pnpm install at the root and forge install in contracts/. Initialize git and make the first commit.
```

### PROMPT 1.2 — Skeleton SentinelGuard contract
**Model: Opus 4.7** (architecture-critical)

```
You are writing the skeleton of SentinelGuard.sol — the main vault wrapper contract for the Sentinel protocol on Mantle.

This is just a SKELETON to deploy and verify on Mantle Sepolia testnet today. Real logic comes later.

Requirements:
1. Solidity 0.8.24, MIT license.
2. The contract should:
   - Inherit OpenZeppelin's Ownable, ReentrancyGuard, Pausable.
   - Accept ETH/MNT deposits via receive() and a deposit(IERC20 token, uint256 amount) function.
   - Have a placeholder function `triggerCircuitBreaker(bytes32 reason)` that emits an event and pauses the contract. Only callable by an authorized "monitor" address (set in constructor).
   - Have a stub function `withdrawToSafety(address recipient, address token, uint256 amount)` callable only by the contract owner when paused.
   - Emit events for every action: AgentRegistered, RulesUpdated, CircuitBreakerTriggered, FundsRescued.
   - Track a struct `Agent { address agentAddress; bytes32 agentId; uint256 registeredAt; bool active; }` mapped by agent address.
   - Have one stub: registerAgent(address agentAddress, bytes32 erc8004Id).

3. Use named errors (custom errors), not string reverts. They're cheaper on Mantle.

4. Add full NatSpec comments. Every external function needs @notice, @param, @return.

5. Create a deployment script at contracts/script/Deploy.s.sol that:
   - Reads PRIVATE_KEY and MONITOR_ADDRESS from environment.
   - Deploys SentinelGuard with the deployer as owner and MONITOR_ADDRESS as monitor.
   - Logs the deployed address.

6. Create a basic test at contracts/test/SentinelGuard.t.sol with at least:
   - testDeployment
   - testRegisterAgent
   - testTriggerCircuitBreakerOnlyMonitor
   - testWithdrawToSafetyOnlyOwner

7. Make sure forge build passes and forge test passes.

DO NOT implement real safety rule logic, real ERC-8004 integration, or real anomaly detection yet. This is the skeleton for deployment-award lock-in. Keep total LOC under 250.
```

### PROMPT 1.3 — Deploy and verify on Mantle Sepolia
**Model: Sonnet 4.6**

```
Deploy contracts/src/SentinelGuard.sol to Mantle Sepolia testnet and verify it on Mantlescan.

Steps:
1. Confirm my .env has PRIVATE_KEY, MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz, MANTLESCAN_API_KEY, MONITOR_ADDRESS set.
2. Check that the deployer wallet has at least 0.5 MNT on Sepolia. If not, output the faucet URL and stop.
3. Run: forge script script/Deploy.s.sol --rpc-url mantle_sepolia --broadcast --verify --verifier-url https://api-sepolia.mantlescan.xyz/api --etherscan-api-key $MANTLESCAN_API_KEY
4. After deployment, extract the contract address from broadcast logs and:
   a. Save it to contracts/deployments/sepolia.json with structure { "SentinelGuard": "0x...", "deployedAt": "ISO timestamp", "chainId": 5003 }.
   b. Print the explorer URL: https://explorer.sepolia.mantle.xyz/address/<address>
   c. Print a checklist of what to do next to claim the Deployment Award.

5. Update README.md with a "Live on Mantle Sepolia" badge linking to the explorer.
```

### MANUAL: Lock the Deployment Award

Submit to DoraHacks now with these 8 things:
1. ✅ Deployed contract address on Mantle Sepolia
2. ✅ Contract verified on Mantle Explorer
3. ✅ Open-source GitHub repo URL (public)
4. ✅ One AI-powered function callable on-chain (the `triggerCircuitBreaker` — say it's "AI-decided" in your description)
5. ✅ Frontend stub URL (deploy Phase 4 to Vercel, can be one page for now)
6. ✅ Deployment address in submission
7. ✅ Demo video (1 min minimum even if rough)
8. ✅ README with setup + deployed address

**This locks $1,000 minimum. Don't skip.**

---

## Phase 2 — Core Contracts (Week 1, Days 4-10)

**Goal:** Build the full smart contract suite. Tests for everything. Still on testnet.

### PROMPT 2.1 — Design the contract architecture
**Model: Opus 4.7** (use extended thinking — this is the most important architecture decision in the project)

```
You are designing the full Sentinel smart contract architecture for Mantle Network. Sentinel is an agent circuit breaker — users wrap their ERC-8004 AI agents into Sentinel, configure safety rules, and Sentinel auto-pauses and rescues funds if the agent misbehaves.

Read the existing skeleton at contracts/src/SentinelGuard.sol first.

Design ALL contracts in the system. For each contract, output:
1. Full purpose statement (2-3 sentences)
2. State variables with types and justification
3. External/public function signatures with NatSpec
4. Events emitted
5. Custom errors
6. Access control (who can call what)
7. Inheritance and OpenZeppelin imports
8. Estimated gas cost on Mantle (mention if any function might exceed reasonable limits)
9. Security considerations: reentrancy vectors, oracle dependencies, upgrade path

Contracts to design:
- SentinelGuard.sol (main vault, holds user funds, executes via agent permission)
- SafetyRules.sol (library or contract — store/evaluate rules: max drawdown, tx rate, allowed protocols, oracle deviation threshold, time-of-day limits)
- AgentRegistry.sol (ERC-8004 wrapper — track which agents are guarded, link to identity NFT)
- ReputationOracle.sol (on-chain scoreboard: each guarded agent accumulates a safety score over time; queryable by anyone)
- EmergencyVault.sol (segregated holding for rescued funds; only owner can withdraw after a timelock)

CONSTRAINTS:
- Mantle uses MNT as gas, not ETH. Code must work with native MNT and ERC-20 tokens (USDY, mETH, USDe, USDT0).
- Mantle has an L1 fee component for tx posting. Minimize calldata in event emissions.
- ERC-8004 identity registry on Mantle is at the mantlenetworkio/erc-8004-contracts repo — interface with IdentityRegistry.sol via interface only (don't fork).
- Contracts MUST be deployable to mainnet within total budget of $20 in MNT (so ~5M gas total across all deploys).

Output the FULL design as docs/CONTRACT_ARCHITECTURE.md. Do not write Solidity code yet — only design. Use mermaid for the contract dependency graph.

Then ask me to review before you implement.
```

### PROMPT 2.2 — Implement SafetyRules
**Model: Sonnet 4.6**

```
Implement contracts/src/SafetyRules.sol following the design at docs/CONTRACT_ARCHITECTURE.md.

Specifically:
1. SafetyRules is a contract (not a library) so rules can be upgraded per-agent.
2. Each Sentinel-guarded agent has its own SafetyRules instance, deployed via factory pattern from SentinelGuard.
3. Rules to implement:
   - maxDrawdownBps (basis points; 1000 = 10%) — measured against high-water-mark deposit
   - maxTxPerHour — rate limit on agent's outbound calls
   - allowedProtocols — mapping(address => bool) of contracts the agent can call
   - oracleDeviationBps — if agent acts on a price that deviates from a Pyth/Chainlink reference by more than this, trigger
   - dailyVolumeCap — in USD-equivalent (use Pyth for pricing)
   - timeOfDayMin / timeOfDayMax — Unix hour-of-day bounds for agent activity

4. Function: `evaluate(AgentState calldata state) external view returns (bool safe, bytes32 reason)`
   - Returns false + reason hash on first violated rule.
   - AgentState struct contains everything needed: currentValue, highWaterMark, txCountThisHour, lastCalledProtocol, lastPriceUsed, lastReferencePrice, last24hVolume, currentHour.

5. Owner of a SafetyRules instance (the agent's user) can update rules with `updateRule(bytes32 ruleKey, uint256 newValue)`.

6. Emit RuleUpdated and RuleViolated events.

7. Custom errors only.

8. Full tests in test/SafetyRules.t.sol — at least one test per rule type, plus a test for combined rule evaluation.

Get forge test passing with 100% line coverage on SafetyRules.sol.
```

### PROMPT 2.3 — Implement AgentRegistry with ERC-8004 integration
**Model: Sonnet 4.6**

```
Implement contracts/src/AgentRegistry.sol.

Context:
- Mantle officially curates the ERC-8004 contracts at github.com/mantlenetworkio/erc-8004-contracts.
- The standard defines three registries: Identity (ERC-721), Reputation, Validation.
- Identity Registry address on Ethereum mainnet: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (the same address may be deployed on Mantle — if not, use a stub interface).

Requirements:
1. Create interfaces/IERC8004Identity.sol with the minimal interface needed:
   - getAgent(uint256 tokenId) returns (address agentAddress, string memory registrationURI)
   - ownerOf(uint256 tokenId) returns (address)
2. AgentRegistry stores: mapping(address agent => uint256 erc8004TokenId), mapping(address agent => GuardConfig), where GuardConfig is { SafetyRules rulesContract, SentinelGuard guardContract, uint256 registeredAt, bool active }.
3. Function `register(uint256 erc8004TokenId, address rulesContract, address guardContract)`:
   - Caller must own the ERC-8004 NFT (verify via ownerOf).
   - Caller must not already be registered.
   - Emit AgentGuarded(address agent, uint256 tokenId, address rules, address guard).
4. Function `deregister(address agent)` — only callable by agent owner; marks inactive but keeps history.
5. Function `getGuardConfig(address agent) external view returns (GuardConfig memory)` — used by monitor.
6. Function `isGuarded(address agent) external view returns (bool)`.
7. Tests in test/AgentRegistry.t.sol — mock the ERC-8004 interface.

Use OpenZeppelin's ERC-721 for the mock.
```

### PROMPT 2.4 — Implement ReputationOracle
**Model: Sonnet 4.6**

```
Implement contracts/src/ReputationOracle.sol.

Purpose: On-chain scoreboard for agents. Other contracts call `getReputation(address agent)` to know if an agent is trustworthy. Score updates as the agent operates under Sentinel.

Score model:
- New agents start at 500 (neutral).
- Successful operation (no rule violations for 24h) → +1 per day, capped at 1000.
- Rule violation: -50 per violation.
- Circuit breaker triggered: -200.
- Recovered funds (post-trigger withdrawal successful): +10 (rewards being prepared).
- Score is capped at [0, 1000].

Requirements:
1. Function `recordEvent(address agent, EventType eventType)` — only callable by SentinelGuard.
2. EventType enum: { CleanDay, RuleViolation, CircuitBreaker, SuccessfulRecovery, SlashingEvent }
3. Public view: `getReputation(address agent) returns (uint256 score, uint256 lastUpdated, uint256 eventCount)`
4. Public view: `getAgentHistory(address agent, uint256 offset, uint256 limit) returns (Event[] memory)` — paginated event log.
5. Events: ReputationChanged(address agent, int256 delta, uint256 newScore, EventType reason)
6. Tests in test/ReputationOracle.t.sol — every event type, score capping, history pagination.

Keep it simple — no token weights, no validator voting, no slashing-with-stake yet. That's v2.
```

### PROMPT 2.5 — Wire SentinelGuard to use all the new contracts
**Model: Opus 4.7** (this is where reentrancy and access-control bugs hide)

```
Rewrite contracts/src/SentinelGuard.sol to use SafetyRules, AgentRegistry, and ReputationOracle.

Read all three contracts and their tests first. Read docs/CONTRACT_ARCHITECTURE.md.

Full requirements:
1. Constructor sets monitor address + agentRegistry + reputationOracle (immutable).
2. User flow:
   a. User deploys their own SafetyRules instance (via factory or direct).
   b. User calls registry.register(erc8004TokenId, rulesContract, address(this)).
   c. User calls guard.depositForAgent(agentAddress, token, amount).
   d. Agent operates by calling guard.executeAsAgent(target, data, value) — guard checks rules.evaluate() BEFORE executing.
3. executeAsAgent logic:
   - Must be called by the registered agent address.
   - Reverts if agent's SafetyRules.evaluate() returns false.
   - On revert from rules: NOT a circuit breaker — just a normal revert.
4. triggerCircuitBreaker(address agent, bytes32 reason):
   - Only callable by monitor.
   - Pauses operations for this agent.
   - Calls reputationOracle.recordEvent(agent, CircuitBreaker).
   - Emits CircuitBreakerTriggered with reason hash.
5. rescueToSafety(address agent, address recipient):
   - Only callable by agent owner (verified via registry → ERC-8004 ownerOf).
   - Must be paused for this agent.
   - Transfers ALL of agent's funds (multiple tokens) to recipient.
   - Calls reputationOracle.recordEvent(agent, SuccessfulRecovery).
6. unpauseAgent(address agent): only callable by agent owner, after a 1-hour cooldown from trigger time.

CRITICAL SECURITY REQUIREMENTS:
- Every external function: ReentrancyGuard.
- All token transfers use SafeERC20.
- Pause state is PER-AGENT, not global.
- No way for monitor to drain funds — they can only pause + emit, never transfer to themselves.
- The agent address being guarded is NOT the agent owner. The owner is the human; the agent is the bot key.

Tests in test/SentinelGuard.t.sol must cover:
- Happy path: register → deposit → agent executes → success.
- Rules block: agent tries to execute violating rule → reverts but no pause.
- Circuit breaker: monitor triggers → rescue funds → reputation updated.
- Access control: non-monitor cannot trigger, non-owner cannot rescue, non-agent cannot execute.
- Reentrancy: hostile recipient cannot re-enter.

Run forge coverage and aim for >90% line coverage. Show me the output.
```

---

## Phase 3 — Off-chain Monitor (Week 2, Days 11-17)

**Goal:** The TypeScript monitor that watches Mantle in real-time and triggers Sentinel.

### PROMPT 3.1 — Design the monitor architecture
**Model: Opus 4.7**

```
Design the off-chain monitor for Sentinel as a Node.js service.

Read docs/CONTRACT_ARCHITECTURE.md and contracts/src/SentinelGuard.sol first.

The monitor must:
1. Listen to Mantle mainnet for events from every registered SentinelGuard contract.
2. For each guarded agent, maintain in-memory state: currentValue, highWaterMark, txCountThisHour, lastVolume24h, lastPriceUsed.
3. Detect anomalies in real-time:
   - Drawdown anomaly: current value drops > X% from HWM (X from on-chain SafetyRules).
   - Tx rate anomaly: agent fires > N tx in 1 hour.
   - Protocol anomaly: agent calls a contract not in allowedProtocols.
   - Oracle deviation: agent's traded price diverges > Y% from Pyth reference (use https://pyth.network/developers/price-feed-ids).
   - Off-hours: agent operates outside agent's configured time window.
4. On anomaly: call SentinelGuard.triggerCircuitBreaker(agent, reasonHash). Use a hot wallet funded with ~1 MNT for gas.
5. Multi-RPC failover: primary = QuickNode/dRPC, secondary = public Mantle RPC.
6. Restart-safe: persist agent state to SQLite or JSON file every 60s.
7. Health endpoint: HTTP /health returns 200 with last-block-seen, uptime, agents-watched.

Write the design as monitor/ARCHITECTURE.md. Include:
- Component diagram (mermaid)
- Class/module list with responsibilities
- Data flow: event in → anomaly detection → trigger out
- Error handling strategy
- Local dev vs production deploy plan (suggest Railway.app or Fly.io for free deploy)

Don't write code yet. Show me the design and ask for review.
```

### PROMPT 3.2 — Implement the event listener
**Model: Sonnet 4.6**

```
Implement monitor/src/listener.ts following monitor/ARCHITECTURE.md.

Requirements:
1. Use viem (not ethers) for WebSocket subscriptions to Mantle.
2. Create a class EventListener with:
   - constructor(rpcUrl: string, fallbackRpcUrl: string)
   - subscribe(contractAddress: string, abi: any, eventName: string, handler: (event) => void)
   - On connection drop: auto-reconnect with exponential backoff.
   - On fallback trigger: log warning, switch to fallback URL.
3. Subscribe to:
   - AgentRegistry.AgentGuarded — adds new agent to watch list.
   - AgentRegistry.AgentDeregistered — removes from watch list.
   - SentinelGuard.AgentExecuted — updates tx count, current value.
   - All major DEX swap events on Mantle (Merchant Moe, Agni, Fluxion) — used to detect agent activity.
4. Persist agent watch list to a local SQLite DB (use better-sqlite3) at monitor/data/agents.db.
5. Expose listener events: 'agentRegistered', 'agentTx', 'priceUpdate', 'error'.

Write monitor/test/listener.test.ts using vitest. Use viem's anvil-fork for testing against a forked Mantle Sepolia.

Add a `pnpm dev` script that starts the listener with hot reload.
```

### PROMPT 3.3 — Implement the anomaly engine
**Model: Opus 4.7** (this is the brain)

```
Implement monitor/src/anomaly.ts — the anomaly detection engine.

Read monitor/ARCHITECTURE.md and contracts/src/SafetyRules.sol first.

Create class AnomalyEngine with:
1. Pure functions for each anomaly type:
   - detectDrawdown(state: AgentState, rules: SafetyRules): AnomalyResult
   - detectTxRate(state, rules): AnomalyResult
   - detectProtocolViolation(state, rules, txTarget): AnomalyResult
   - detectOracleDeviation(state, rules, agentPrice, pythPrice): AnomalyResult
   - detectOffHours(state, rules, currentTimestamp): AnomalyResult
2. Main entry: evaluateAll(agent, state, rules, context): AnomalyResult[]
3. AnomalyResult = { anomaly: boolean, type: AnomalyType, reasonHash: hex, severity: 'warn' | 'critical', message: string }
4. ONLY 'critical' triggers the on-chain circuit breaker. 'warn' is logged.
5. Add a Pyth integration: monitor/src/pyth.ts that fetches latest price for a given token from https://hermes.pyth.network/api/latest_price_feeds?ids[]=<feed_id>. Cache 30s.
6. Integration with the contracts:
   - Read the on-chain SafetyRules for each agent via viem readContract.
   - Cache rules per-agent for 60s (rules don't change often).

Write monitor/test/anomaly.test.ts with at least 3 test cases per anomaly type (no anomaly, soft anomaly, hard anomaly). Use vitest fixtures.

Bonus: add a CLI debug command `pnpm monitor:debug --agent=0x... --simulate=drawdown` that triggers a specific anomaly type for testing the trigger pipeline.
```

### PROMPT 3.4 — Implement the trigger pipeline
**Model: Sonnet 4.6**

```
Implement monitor/src/trigger.ts — the on-chain trigger executor.

Requirements:
1. Class Trigger with:
   - constructor(walletPrivateKey, rpcUrl, sentinelGuardAddress)
   - async fire(agent: Address, reasonHash: Hex, reasonText: string): Promise<TxResult>
2. On fire():
   - Estimate gas with viem.
   - Bump priority fee by 20% to ensure fast inclusion.
   - Call sentinelGuard.triggerCircuitBreaker(agent, reasonHash).
   - Wait for 1 confirmation.
   - Return tx hash + block number + cost.
3. Idempotency: if a circuit breaker for this agent fired in the last 5 minutes, don't fire again.
4. Audit log: append every trigger to monitor/data/triggers.log.jsonl with full context.
5. Alerting: on successful trigger, POST to a configurable webhook (set ALERT_WEBHOOK_URL in env) — used for Discord/Slack notifications during demo.

Wire it all together in monitor/src/index.ts:
```ts
const listener = new EventListener(...);
const engine = new AnomalyEngine(...);
const trigger = new Trigger(...);

listener.on('agentTx', async (event) => {
  const state = await stateStore.get(event.agent);
  const rules = await rulesCache.get(event.agent);
  const results = await engine.evaluateAll(event.agent, state, rules, event);
  const critical = results.find(r => r.severity === 'critical');
  if (critical) {
    await trigger.fire(event.agent, critical.reasonHash, critical.message);
  }
});
```

Add tests. Run the full monitor against your Sepolia deployment for 10 minutes and capture the logs as proof.
```

---

## Phase 4 — Frontend Dashboard (Week 3, Days 18-24)

**Goal:** A clean Next.js dashboard. This is where you win UI/UX Award ($3K) and the first-30-seconds judge test.

### PROMPT 4.1 — Design the UI
**Model: Opus 4.7** (design judgment matters)

```
Design the Sentinel web frontend. The app lives at /web in a Next.js 14 app router project with Tailwind CSS and shadcn/ui.

Pages:
1. / (landing) — hero section that IS the product. Above the fold:
   - Headline: "The circuit breaker for autonomous AI agents."
   - Sub: "Wrap your ERC-8004 agent. Sleep at night."
   - Live counter: "X agents guarded, $Y locked, Z circuit breakers triggered."
   - Big "Connect Wallet" CTA.
   - Below: short explainer + a live "Watch Sentinel" panel showing a real agent being monitored right now.
2. /dashboard — user dashboard. Shows their guarded agents, status, balance, reputation.
3. /onboard — step-by-step flow: connect wallet → select ERC-8004 agent → configure rules → deposit funds → activate.
4. /agent/[id] — detail page for one agent. Live status, decision feed, reputation score chart, alerts.
5. /leaderboard — public leaderboard of all guarded agents ranked by reputation score. Tweetable.
6. /watch — live demo mode. Anyone can watch agents on testnet getting saved in real-time, with sound effects.

Design constraints:
- Color: dark mode default. Single accent color (suggest electric blue #2563eb).
- Typography: sharp, technical. Inter for UI, JetBrains Mono for data.
- Brand: "SENTINEL" wordmark in monospace, all caps.
- No emoji. No decorative gradients. No glowing buttons. Trust signals only.
- Mobile-first.

Output as docs/UI_DESIGN.md with:
- Sitemap diagram
- Wireframes for each page (ASCII or describe in detail)
- Component inventory (which shadcn/ui components needed)
- State management plan (zustand suggested)
- Wallet connection lib (wagmi + viem + RainbowKit)

Don't write code yet. Show me the design.
```

### PROMPT 4.2 — Build the landing page
**Model: Sonnet 4.6**

```
Implement web/app/page.tsx — the Sentinel landing page following docs/UI_DESIGN.md.

Requirements:
1. Hero section above the fold. On a 1440x900 screen, everything must be visible.
2. Live data: read from the deployed SentinelGuard contract on Mantle Sepolia (use contracts/deployments/sepolia.json for address). Show:
   - Total agents guarded (count from AgentRegistry events)
   - Total value locked (sum across all guards in USD using Pyth)
   - Total circuit breakers triggered (count of CircuitBreakerTriggered events)
3. The numbers must animate up on page load (use react-countup).
4. The "Watch Sentinel" panel below the hero shows the 3 most-recent events from any guarded agent, with timestamps and links to mantlescan.
5. Use Server Components where possible. Client-side only for wallet + animations.
6. Connect wallet via RainbowKit. On connect, redirect to /onboard if no agents registered, else /dashboard.
7. Footer: links to GitHub, Twitter, Docs.
8. SEO meta tags + OG image (use og:image based on the hero section — generate the OG image with @vercel/og).

Performance:
- Lighthouse score > 90 on every metric.
- Total bundle < 200kb gzipped.

Deploy to Vercel and give me the URL.
```

### PROMPT 4.3 — Build the onboarding flow
**Model: Sonnet 4.6**

```
Implement web/app/onboard/page.tsx — the step-by-step agent onboarding wizard.

Steps:
1. Connect wallet (already done if arriving here).
2. Select your ERC-8004 agent: list all ERC-8004 NFTs owned by the connected address. If none, show "Mint one at Mantle ERC-8004 Registry" CTA.
3. Configure SafetyRules: form with all 6 rule fields (maxDrawdownBps, maxTxPerHour, allowedProtocols, oracleDeviationBps, dailyVolumeCap, timeOfDayMin/Max). Smart defaults pre-filled (10%, 50/hr, common Mantle DEXes, 5%, $10k, 9-21 UTC).
4. Deposit funds: choose token (MNT, mETH, USDY, USDe, USDT0), amount, approve + deposit in two clicks. Use ERC-20 permit where supported.
5. Confirm: review everything, deploy SafetyRules instance + register agent + activate guard. One tx if possible, multicall if needed.
6. Success: show the agent's dashboard URL, X share template, "View on Mantlescan" link.

Tech:
- Use react-hook-form + zod for validation.
- shadcn/ui Stepper for progress.
- Each step is a separate component in web/components/onboard/.
- Use wagmi useWriteContract hook.
- Loading states + skeleton screens for every async action.
- Friendly error messages — never raw EVM revert strings.

Deploy to staging URL and let me test the full flow on Sepolia.
```

### PROMPT 4.4 — Build the watch/live page
**Model: Sonnet 4.6** (this is the demo magic)

```
Implement web/app/watch/page.tsx — the live demo page. THIS IS THE CENTERPIECE OF THE DEMO VIDEO.

Purpose: Anyone (no wallet required) can watch Sentinel work in real-time. During the hackathon livestream, this page will be projected.

Requirements:
1. Real-time feed of ALL events across ALL guarded agents on Sepolia:
   - New agent registered
   - Agent executed action
   - Anomaly detected (warning level)
   - CIRCUIT BREAKER TRIGGERED (red flash, big animation)
   - Funds rescued to safety
2. Each event is a card. Cards animate in from top, push old ones down. Keep last 20.
3. A "Stats Bar" at top showing live aggregates.
4. A "Watched Agents" sidebar showing currently-active agents with their current state visualized as a small dial (green/yellow/red status).
5. Sound effects on circuit breaker trigger (subtle alarm — use howler.js, but mute by default).
6. Use WebSockets to the monitor — add a /events SSE endpoint to monitor/src/index.ts.
7. Mobile-responsive but optimized for big screen / livestream view.

Visual style: monospaced font, terminal-like, but beautiful. Think Cloudflare's live attack dashboard or Datadog's incident view.

Build this so it works when 3 demo agents (Phase 5) are intentionally failing.
```

### PROMPT 4.5 — Build the agent detail page + leaderboard
**Model: Sonnet 4.6**

```
Implement two pages:
1. web/app/agent/[id]/page.tsx — detail view for one guarded agent. Shows:
   - ERC-8004 identity metadata (image, name from NFT URI)
   - Current SafetyRules config (read-only display)
   - Live status indicator
   - Reputation score with sparkline chart of history (use recharts)
   - Recent decision feed (last 50 events)
   - "Manage" button → opens rules editor modal (owner only)
   - Mantlescan link
2. web/app/leaderboard/page.tsx — public leaderboard. Shows:
   - Top 100 guarded agents by reputation score
   - Columns: rank, agent name, score, days guarded, # of breakers triggered, total volume
   - Filterable by chain (mainnet vs testnet), sortable by all columns
   - Each row links to /agent/[id]
   - "Share Leaderboard" button that generates a tweetable image (using og-image API)

Make the leaderboard the most-shared piece of the project. The image template should look prestigious — like a Bloomberg terminal screenshot. This drives Community Voting prize.
```

---

## Phase 5 — Demo Agents + Mainnet Deploy (Week 4, Days 25-31)

**Goal:** Build the "victim" agents that prove Sentinel works, then deploy production to Mantle Mainnet.

### PROMPT 5.1 — Build three demo "victim" agents
**Model: Sonnet 4.6**

```
Build three demo agents in demo-agents/ that INTENTIONALLY fail in different ways, so Sentinel can save them on camera.

Each agent is a Node.js script that:
1. Has its own ERC-8004 identity (minted by us via a setup script).
2. Is registered with Sentinel using sane SafetyRules.
3. Has been funded with $100 of testnet USDC + MNT.
4. Runs on a schedule (node-cron) and SHOULD trade normally, but has a hidden bug that causes failure mode at a specific time.

The three agents:

AGENT 1 — "YieldChaser" (drawdown victim)
- Strategy: rotate between mETH and USDY based on simulated yield.
- BUG: After 5 successful rotations, "miscalculates" and yolos 50% of capital into a manipulated test token.
- Expected: Sentinel detects 50% drawdown > 10% rule → triggers → rescues remaining funds.
- File: demo-agents/src/yieldchaser.ts

AGENT 2 — "ProtocolHopper" (allowlist victim)
- Strategy: scans Mantle DEXes for best swap rates, executes on Merchant Moe / Agni.
- BUG: After ~10 swaps, "discovers" a fake DEX (a malicious test contract we'll deploy) and tries to trade there.
- Expected: Sentinel detects unallowed protocol call → triggers → rescues.
- File: demo-agents/src/protocolhopper.ts

AGENT 3 — "Insomniac" (off-hours victim)
- Strategy: normal LP rebalancer.
- BUG: After running fine during configured hours, "ignores" off-hours rule and tries to trade at 3am UTC.
- Expected: Sentinel detects off-hours → triggers → rescues.
- File: demo-agents/src/insomniac.ts

Each agent has:
- Its own .env (private key, agent id)
- A "story log" that prints what it's "thinking" so the demo video can show the agent's reasoning
- Pretty terminal output (chalk + boxen) for streaming
- A `pnpm agent:reset` script to redeploy and refund for repeated demos

Also build demo-agents/src/setup.ts that:
- Mints 3 ERC-8004 identities (one per agent)
- Deploys 3 SafetyRules instances
- Registers all 3 with SentinelGuard
- Funds each agent's guard with test tokens

The demo flow:
$ pnpm setup        # one-time
$ pnpm agents:start # starts all 3 agents
$ open /watch       # watch them get saved
```

### PROMPT 5.2 — Mainnet deployment (Days 28-31)
**Model: Opus 4.7** (mainnet money on the line)

```
Deploy the FULL Sentinel system to Mantle Mainnet.

Pre-flight (you must verify all of these before proceeding):
1. forge test passes 100% on the latest commit.
2. forge coverage > 90% on all production contracts.
3. Slither static analysis is clean (run: slither contracts/src --exclude-dependencies). Fix any HIGH severity findings.
4. Deployer wallet has at least 0.5 MNT on Mantle Mainnet.
5. Monitor address is a separate wallet from deployer. Funded with 1 MNT.

Deployment order:
1. Deploy ReputationOracle
2. Deploy AgentRegistry (passes ReputationOracle address)
3. Deploy SentinelGuard (passes AgentRegistry, ReputationOracle, monitor address)
4. Verify all three on Mantlescan.
5. Save addresses to contracts/deployments/mainnet.json.
6. Update web/.env.production with new mainnet addresses.
7. Update monitor/.env.production with new mainnet addresses.
8. Redeploy web to Vercel production.
9. Redeploy monitor to Railway/Fly with new env.

After deploy:
- Verify all 3 contracts are visible and verified on https://mantlescan.xyz
- Do one test transaction: register a test ERC-8004 (mint one for yourself), wrap with cheap rules, deposit 1 USDY.
- Confirm monitor sees the event and starts watching.
- Capture screenshots of every step for the demo video.

Cost target: under $20 in MNT total. If projected cost exceeds $30, STOP and ask for review.
```

---

## Phase 6 — Polish, Demo, Submission (Weeks 5-6, Days 32-42)

**Goal:** Win the prizes. This phase is more important than people think.

### PROMPT 6.1 — Write the README
**Model: Sonnet 4.6**

```
Write the production README.md for the Sentinel root.

Structure (in this exact order):
1. Hero: project name + tagline + status badge (mainnet deployed).
2. One-line problem statement: what's broken.
3. One-line solution statement: what Sentinel does.
4. Live links (mainnet contract on Mantlescan, web app URL, demo video).
5. Animated GIF or screenshot of /watch in action (placeholder, I'll add later).
6. Why Mantle (the unfair advantage paragraph).
7. Architecture diagram (mermaid).
8. Quick start for developers (npm install, .env setup, run locally).
9. Project structure (the monorepo layout).
10. Deployment addresses (mainnet + testnet).
11. Hackathon tracks this qualifies for + link to DoraHacks submission.
12. Team + contact.
13. License (MIT).

Tone: confident, technical, concise. No fluff. Every section in 1-3 sentences max. The first 30 seconds of reading should make a judge want to install it.

Read existing README.md placeholder and replace it entirely.
```

### PROMPT 6.2 — Demo video script
**Model: Opus 4.7** (this is the storytelling)

```
Write the demo video script for Sentinel. 2 minutes max. This is the video that goes on the DoraHacks submission and gets shared on X.

Structure:
- 0:00-0:15 — Hook. Open on the /watch page. A live agent's status is green. Text overlay: "This is a real AI agent managing $100 on Mantle right now."
- 0:15-0:30 — Problem. Stock-image style: news headlines of AI agents going wrong. "What happens when it fails?"
- 0:30-0:45 — Solution intro. Cut to logo. "Sentinel. The circuit breaker for autonomous AI agents on Mantle."
- 0:45-1:15 — Live demo. Show YieldChaser running. Suddenly it makes a bad trade. RED ALERT animation. Sentinel triggers. Funds move to safety. Show the Mantlescan tx.
- 1:15-1:35 — How it works. 4 screens: 1) Wrap your agent. 2) Set safety rules. 3) Sentinel watches. 4) Funds protected.
- 1:35-1:50 — Why Mantle. Quick mention of ERC-8004, native RWA assets, $4B treasury.
- 1:50-2:00 — Close. Logo + URL + "Try it on mainnet today."

Output as docs/VIDEO_SCRIPT.md with:
- Shot-by-shot breakdown.
- Voiceover text (or text overlay if no VO).
- Music suggestion (no copyrighted tracks — use Epidemic Sound or YouTube Audio Library; specify genre).
- Tool recommendation: Loom, OBS, or Descript for recording. Descript for editing.

Then list every screen recording you need to capture, in order, so I can batch-record them.
```

### PROMPT 6.3 — Social campaign for Community Voting
**Model: Sonnet 4.6**

```
Create the social campaign for Community Voting prize ($8,500). The submission goes on DoraHacks where the project with the most X engagement wins.

Output as docs/SOCIAL_CAMPAIGN.md:

1. X account setup:
   - Handle: @sentinel_guard (or @guardsentinel)
   - Bio: "The circuit breaker for autonomous AI agents on @Mantle_Official. ERC-8004 native."
   - Banner: project logo on dark bg.

2. Pre-submission content (5 tweets, post one per day during build):
   - Tweet 1: "We're building <something>. Why nobody else has."
   - Tweet 2: Architecture diagram screenshot.
   - Tweet 3: First mainnet deploy screenshot.
   - Tweet 4: A live circuit-breaker event captured.
   - Tweet 5: Leaderboard screenshot.

3. Launch thread (10 tweets, post on submission day):
   - Tweet 1: Hook. "What if your AI agent loses everything overnight? We built the circuit breaker."
   - Tweet 2: The problem (with examples).
   - Tweet 3-7: How Sentinel solves it, with screenshots.
   - Tweet 8: Why only on Mantle.
   - Tweet 9: Live demo URL.
   - Tweet 10: CTA + voting link.

4. Engagement tactics:
   - Tag every Mantle ecosystem account.
   - Tag every judge org (@AlloraNetwork, @nansen_ai, @virtuals_io, etc.) without being spammy.
   - Reply to threads about AI agents going wrong with "ah, this is exactly what we solve. <link>"
   - Build a Discord/Telegram of 20-30 supporters before launch day for amplification.

5. Demo loop video for X (15 seconds, looping):
   - Just the /watch page during a circuit-breaker event. No words. Pure visceral.

Write all tweet drafts ready to copy-paste. Be concise — every tweet under 280 chars. No emojis.
```

### PROMPT 6.4 — Final QA + submission
**Model: Sonnet 4.6**

```
Run the final submission QA. Check off every item:

Hackathon requirements (must have ALL):
- [ ] Smart contracts deployed on Mantle Mainnet (preferred) AND/OR Sepolia
- [ ] Contracts verified on Mantlescan — confirm visually
- [ ] At least one AI-powered function callable on-chain (the anomaly detection trigger)
- [ ] Frontend demo at a public URL (NOT localhost) — open it in incognito to confirm
- [ ] Deployment addresses in DoraHacks submission text
- [ ] Demo video ≥ 2 min on YouTube/Loom — link works
- [ ] Open-source GitHub repo with README — confirm README has all sections
- [ ] One-line pitch (have it ready: "Sentinel — the circuit breaker for autonomous AI agents on Mantle")

Track qualification check:
- [ ] AI DevTools: confirmed (Sentinel IS a devtool for agent builders)
- [ ] AI x RWA: confirmed (RWA-native asset protection)
- [ ] Agentic Economy: confirmed (uses Byreal Skills? — if not yet, add Byreal Agent Skills as an example "watched agent" in the demo)

Polish checklist:
- [ ] Custom domain pointed at Vercel
- [ ] X account has 5+ pre-launch tweets, looks alive
- [ ] OG image renders correctly when URL is pasted in a tweet
- [ ] All Mantlescan links work
- [ ] Mobile experience is functional (not perfect, just functional)
- [ ] README has a working "try it locally" path that a judge could follow

Outstanding bugs:
- Run pnpm test across all packages and capture failures. Fix anything critical.

Generate the DoraHacks submission text in docs/SUBMISSION.md, ready to paste.
```

---

## Quick Reference — Claude Code Tips

### Setup
```bash
# Install
npm install -g @anthropic-ai/claude-code

# Login
claude

# In your project root, run claude and it picks up the working dir.
```

### Switching models mid-session
- `/model opus` — switch to Opus 4.7
- `/model sonnet` — switch to Sonnet 4.6
- `/model haiku` — switch to Haiku 4.5

### Cost-saving tactics
1. Keep CLAUDE.md in your repo root with project conventions. Claude Code reads it automatically.
2. Use `/clear` between phases to drop context you don't need.
3. For long-running tasks (Phase 2.5, Phase 3.3), let Opus think — don't interrupt.
4. For mechanical edits (renaming, formatting, file moves), use Haiku.

### CLAUDE.md template for this project
Put this in your repo root before starting Phase 2:

```markdown
# Sentinel — Project Conventions

## Stack
- Contracts: Solidity 0.8.24 + Foundry. No Hardhat.
- Monitor: Node.js 20 + TypeScript + viem (NOT ethers v6 in new code).
- Frontend: Next.js 14 app router + Tailwind + shadcn/ui + wagmi.

## Chain
- Primary: Mantle Mainnet (chain 5000). RPC: https://rpc.mantle.xyz. Explorer: https://mantlescan.xyz.
- Testnet: Mantle Sepolia (chain 5003). RPC: https://rpc.sepolia.mantle.xyz.
- Gas token: MNT (not ETH).

## Conventions
- All contracts use custom errors, not require strings.
- All token transfers use SafeERC20.
- All external functions use ReentrancyGuard where state changes occur.
- All TypeScript uses strict mode. No any.
- All commits follow Conventional Commits (feat:, fix:, chore:).

## Don't do
- Don't use ethers v6 in new code — use viem.
- Don't hardcode RPC URLs — always env vars.
- Don't deploy without forge test passing.
- Don't push private keys.

## When in doubt
Read docs/CONTRACT_ARCHITECTURE.md and docs/UI_DESIGN.md first.
```

---

## Critical Dates

| Date | Milestone |
|---|---|
| **Today** | Phase 0 — setup, domain, accounts |
| **Day 3** | Phase 1 done. Lock $1K Deployment Award. |
| **Day 10** | Phase 2 done. All contracts on testnet with tests. |
| **Day 17** | Phase 3 done. Monitor running. |
| **Day 24** | Phase 4 done. Web app deployed. |
| **Day 31** | Phase 5 done. Mainnet live. Demo agents running. |
| **Day 38** | Phase 6 polished. Video recorded. |
| **Day 42** | Submission. |
| **June 16** | Deadline. |

---

## Budget

| Item | Cost |
|---|---|
| Domain | $12 |
| Vercel (Pro for OG images) | $0 (free tier works) |
| Railway/Fly for monitor | $0 (free tier) |
| Mainnet deploy gas | ~$10 |
| Demo agent funding (testnet) | $0 |
| Demo agent funding (mainnet, optional) | $10-20 |
| Claude API for Claude Code | $30-100 over 6 weeks if disciplined |
| **Total out of pocket** | **~$60-150** |
| **Prize ceiling** | **$30,000** |

---

## Final Note

The biggest risk for Sentinel is that you ship it half-built. A polished demo of ONE clean circuit-breaker save is worth more than five half-working features. Polish the first 30 seconds of the watch page like your life depends on it.

Build in public. Tweet daily. Tag Mantle accounts. Make judges want to find you before judging starts.

Good luck. Go ship.
