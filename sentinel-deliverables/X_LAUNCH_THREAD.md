# Sentinel — X Social Campaign

> Schedule these in advance. Posting cadence matters as much as content.

## Account setup

**Handle (pick available one):**
- @sentinel_guard
- @sentinelmantle
- @guardsentinel

**Bio:**
```
The circuit breaker for autonomous AI agents.
ERC-8004 native. Built on @Mantle_Official.

Wrap your agent. Sleep at night.

→ sentinel.guard
```

**Profile pic:** Black background, white SENTINEL wordmark (see logo file).
**Banner:** Dark gradient, single line of text: "WHEN YOUR AI AGENT FAILS, SENTINEL IS ALREADY MOVING."
**Pinned tweet:** The launch thread (Thread B below).

---

## Posting schedule

| Day | What to post | Type |
|---|---|---|
| Day 1 | Pre-launch tweet #1 | Single tweet |
| Day 4 | Pre-launch tweet #2 | Single tweet |
| Day 8 | Pre-launch tweet #3 | Single tweet |
| Day 14 | Pre-launch tweet #4 | Single tweet |
| Day 21 | Pre-launch tweet #5 | Single tweet |
| Day 28 | Pre-launch tweet #6 | Single tweet |
| Day 35 | Mainnet deploy announcement | Single tweet |
| Submission day | Launch thread (Thread B) | 10-tweet thread |
| +1 day | Reply thread (Thread C) — answer common Qs | Self-reply thread |
| +2 days | Demo video repost | Quote tweet |

---

## Thread A — Pre-launch tweets (drip-feed over 5 weeks)

Each is a standalone tweet. Post one per week. Keep momentum visible to judges.

### Tweet A1 — The provocation
*Post Day 1.*

```
What happens when an autonomous AI agent loses your money at 3am?

Nobody is building the safety layer.

Starting today, we are.

Building in public for @Mantle_Official Turing Test Hackathon.
```

### Tweet A2 — The architecture tease
*Post Day 4. Attach: contract architecture diagram (use the mermaid diagram from your repo).*

```
The architecture.

Three contracts. One off-chain monitor. One reason it can only exist on Mantle.

ERC-8004 + native RWA assets + EigenDA recording.

Building this week.
```

### Tweet A3 — First deploy
*Post Day 8. Attach: screenshot of verified contract on Mantle Sepolia.*

```
Skeleton deployed on Mantle Sepolia.

Contract verified. Tests passing.

This is the foundation. Full system in 4 weeks.

[link to Mantlescan]
```

### Tweet A4 — The off-chain brain
*Post Day 14. Attach: screen recording of monitor logs in terminal.*

```
The Sentinel monitor running for 48 hours straight.

Watching every guarded agent. Sub-second anomaly detection.

When something breaks, the on-chain trigger fires before the agent can do more damage.
```

### Tweet A5 — The demo agents
*Post Day 21. Attach: short clip of three demo agents starting up.*

```
We built 3 demo agents that intentionally fail in different ways.

YieldChaser — yolos into a bad position.
ProtocolHopper — calls an unallowed contract.
Insomniac — trades at 3am.

Sentinel saves all three. On camera.
```

### Tweet A6 — Mainnet deploy
*Post Day 28. Attach: screenshot of Sentinel mainnet contract on mantlescan.xyz.*

```
SENTINEL is live on Mantle Mainnet.

3 contracts. ~$8 in gas. Verified on @mantlescan.

The first agent circuit breaker built for ERC-8004.

[mantlescan link]
```

---

## Thread B — Launch thread (10 tweets)

*Post on the day of submission. This is THE thread.*

### Tweet B1 — Hook
*Attach: 15-second looping video of /watch page showing a circuit breaker event.*

```
What happens when your AI agent loses everything overnight?

We built the circuit breaker.

A thread on Sentinel — and why this exact problem can only be solved on Mantle. 🧵
```

### Tweet B2 — Problem
```
1/

In the last year alone, autonomous agents have caused millions in losses.

LLM hallucinations. Oracle manipulation. Prompt injection. Off-hours yolo trades.

There is currently zero infrastructure to protect users when an agent goes wrong.

Sentinel fixes this.
```

### Tweet B3 — Solution
*Attach: architecture diagram.*

```
2/

How Sentinel works:

1. Wrap your ERC-8004 agent into Sentinel.
2. Set safety rules (drawdown %, allowed protocols, rate limits, time windows).
3. An off-chain monitor watches every action in real-time.
4. On anomaly: auto-pause + rescue funds before more damage.
```

### Tweet B4 — Live demo
*Attach: 30-second screen recording of a real circuit-breaker event on mainnet.*

```
3/

This is a real agent on Mantle mainnet right now.

It just tried to yolo 50% of its capital.

Watch what happens.

[video]

Funds saved in 9 seconds. Verifiable on-chain.
```

### Tweet B5 — Three contracts
```
4/

Under the hood, Sentinel is three Solidity contracts on Mantle:

→ SafetyRules — per-agent rule config
→ AgentRegistry — ERC-8004 wrapper + guard mapping  
→ SentinelGuard — vault + circuit breaker logic
→ ReputationOracle — public agent track record

All verified on @mantlescan.
```

### Tweet B6 — The monitor
```
5/

The off-chain monitor is the brain.

Built in TypeScript. Sub-second latency.

It watches every guarded agent, evaluates SafetyRules against live state, and fires the on-chain trigger when something breaks.

Open source. Self-hostable. Multi-RPC failover.
```

### Tweet B7 — Why Mantle
```
6/

Why this only exists on Mantle:

→ Official ERC-8004 contracts curated by Mantle
→ Native RWA assets (USDY, mETH, USDe) for real economic exposure
→ Sub-cent gas → real-time monitoring economically viable
→ $4B+ treasury → real institutional demand for agent safety
```

### Tweet B8 — Reputation
*Attach: leaderboard screenshot.*

```
7/

Every guarded agent builds an on-chain reputation.

Clean operations earn score. Violations slash it. Triggered breakers are public.

This becomes the credit score for autonomous agents — and the foundation for trustless agent-to-agent commerce.

[leaderboard image]
```

### Tweet B9 — Try it
```
8/

Try Sentinel right now:

→ Watch live: sentinel.guard/watch
→ Wrap your own agent: sentinel.guard/onboard
→ Read the contracts: github.com/[your-org]/sentinel-mantle
→ See it on mainnet: mantlescan.xyz/address/[address]
```

### Tweet B10 — Vote + close
```
9/

Built for the Mantle Turing Test Hackathon by [you / your team].

Open source. MIT license. Live on mainnet today.

If you build with autonomous agents — or trust them with money — you need this.

Vote for Sentinel here: [DoraHacks link]

/end 🛡️
```

---

## Thread C — FAQ self-reply (post next day, reply to Thread B)

Pinned reply to Thread B with the most common questions. Builds depth and shows you're engaging.

### C1
```
Common questions answered:

1. Does this work with non-ERC-8004 agents?
2. Can the monitor steal funds?
3. What if the monitor goes offline?
4. Is it audited?
5. Why not just use Nexus Mutual?

Answers ↓
```

### C2
```
1/ Does this work with non-ERC-8004 agents?

v1 requires ERC-8004 identity. The reputation system depends on it.

v2 will add a wrapper for legacy bots. But we believe every agent will eventually have an on-chain identity, and ERC-8004 just went live on Ethereum mainnet on Jan 29, 2026.
```

### C3
```
2/ Can the monitor steal funds?

No.

The monitor wallet can only pause and emit events. It cannot transfer funds anywhere.

Rescue function is gated to the agent owner (via ERC-8004 ownerOf check), and only callable after a circuit breaker triggers.

This is the security perimeter.
```

### C4
```
3/ What if the monitor goes offline?

Two answers:

→ The monitor is open-source and self-hostable. Anyone (including the agent owner) can run their own.
→ v2 will add decentralized monitor sets via stake-and-slash, similar to AVS architecture on EigenLayer.
```

### C5
```
4/ Is it audited?

Not yet. v1 is a hackathon submission.

But: 100% test coverage on contracts, slither analysis clean, custom errors throughout, ReentrancyGuard on every state-changing function, SafeERC20 for transfers.

Will pursue formal audit before incentivized mainnet use.
```

### C6
```
5/ Why not just use Nexus Mutual?

Nexus insures *protocols*. Sentinel protects *agents*.

When a protocol fails, Nexus pays out after a vote.
When an agent fails, Sentinel pauses it in seconds and rescues funds before more damage.

Different problem. Different solution. Complementary.
```

---

## Engagement tactics

### Accounts to tag (only when relevant — never spam)

**Hackathon ecosystem:**
- @Mantle_Official
- @Bybit_Official  
- @byreal_io
- @DoraHacks
- @hackquest_

**Judge organizations (use ONLY in launch thread):**
- @AlloraNetwork
- @nansen_ai
- @virtuals_io
- @AnimocaBrands
- @ElfaAI
- @Hashed_Official
- @fourpillars_ (Four Pillar)

**Don't tag in every tweet.** Once in launch thread is enough. Tagging the same accounts repeatedly is spam and works against you.

### Replies to seed in the days before launch

Find tweets about:
- AI agents losing money / getting hacked
- ERC-8004 discussions
- DeFi safety / risk management
- Mantle ecosystem updates

Reply with **value**, not pitch. Examples:

> "Yeah, this is the exact failure mode we've been thinking about. The fundamental issue is there's no separation between agent execution authority and human override authority."

Then later, when someone asks what you're building: "We're building it — sentinel.guard."

### Building public momentum

Aim for at least:
- 10 followers/week during build
- 1 reply or quote from a Mantle account
- 1 mention from a Web3 dev with > 5K followers
- 1 tag from a hackathon judge org

Track these. If you're not getting them, your content isn't resonating — change the angle.

---

## 15-second loop video script

For the launch thread's hero video. Posts on X, used as OG image fallback.

```
[0:00] Screen: /watch page. Three agent dials, all green.
[0:03] One dial starts pulsing yellow.
[0:05] RED FLASH. Alert card slides in: "CIRCUIT BREAKER TRIGGERED — drawdown exceeded."
[0:08] Card animates: "RESCUING FUNDS..."
[0:12] Card animates: "FUNDS SAFE. Saved $84 in 9 seconds."
[0:15] Logo lockup: SENTINEL — sentinel.guard
[loop]
```

No sound. Captions baked in. Vertical 9:16 also exists for Stories/Reels.

---

## What NOT to do

- Don't tweet "🚀 LFG!!! Big things coming 👀" — judges hate this energy.
- Don't tag every account on every tweet — it reads as desperate.
- Don't post inspirational quotes from Naval or Balaji — wrong audience.
- Don't reply to every Mantle tweet with your project link.
- Don't argue with anyone publicly. Ever. Even if they're wrong.
- Don't tweet hourly. Daily is the cadence.

---

## Reply templates for incoming engagement

**Someone asks how it works:**
> "Wrap your ERC-8004 agent into Sentinel, set rules (drawdown limit, allowed protocols, rate cap, time window), and an off-chain monitor auto-pauses + rescues if the agent misbehaves. Try it: sentinel.guard"

**Someone says "cool project":**
> "Thanks — would love your feedback when you have 2 minutes to look. Especially curious if the reputation oracle design makes sense to you."

**Someone says "this is just X with extra steps":**
> "Real question. The difference is [X protects against protocol failures with payouts after the fact / Sentinel pauses agents in real-time before damage compounds]. They're complementary. Happy to discuss specifics."

**Someone says it won't work / criticizes:**
> "Appreciate the pushback — what's the specific scenario you're imagining? Want to make sure we're solving the right thing."

Always respond fast. Always respond substantively. Always say thank you when someone engages.
