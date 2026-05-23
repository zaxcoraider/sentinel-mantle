# Sentinel — UI Design

> Design spec for the Sentinel web frontend (`/web`). Next.js 14 (app router) +
> Tailwind + shadcn/ui + wagmi + viem + RainbowKit. Read alongside `docs/BRAND.md`
> (visual language) and `docs/CONTRACT_ARCHITECTURE.md` (data sources).
>
> This is PROMPT 4.1 output: design only, no implementation. Code lands in 4.2–4.5.

---

## 1. Design principles (applied)

Pulled from `docs/BRAND.md`, made concrete for this app.

- **Bloomberg terminal, not landing page.** Dense, monospace data. Whitespace is
  structure, not decoration. The product looks like an instrument you trust with money.
- **One accent.** `sentinel-blue #2563eb` on ≤5% of any screen — CTAs, links, focus
  rings, the live "active" pulse. Never as a fill.
- **Red is sacred.** `sentinel-danger #dc2626` appears *only* when a circuit breaker is
  live or an agent is paused. If red is on screen, something is wrong. That's the point.
- **Three status colors, always the same meaning everywhere:**
  - `green` (emerald-500) = guarded, healthy, within all thresholds
  - `amber` (amber-500) = warn — a metric is ≥80% of its limit (monitor `warn` tier)
  - `red` (`sentinel-danger`) = critical — breaker tripped / paused / rescued
- **Type split is load-bearing.** Inter for prose and labels; JetBrains Mono for every
  number, address, hash, score, and status. If a human typed it, Inter. If the chain
  produced it, Mono.
- **Motion communicates state.** 150–300ms, `cubic-bezier(0.4,0,0.2,1)`. The only
  dramatic animation in the whole app is the circuit-breaker alert (red flash + slide +
  shake). Everything else is quiet.
- **No emoji. No gradients. No glows.** Trust signals only.

---

## 2. Sitemap

```
                          ┌─────────────────────┐
                          │   /  (landing)       │  public · SSR
                          │  hero + live counters│
                          │  + "Watch Sentinel"  │
                          └──────────┬───────────┘
                                     │ Connect Wallet
                 ┌───────────────────┼────────────────────┐
                 │ no agents                │ has agents    │
                 ▼                          ▼               │
        ┌─────────────────┐        ┌─────────────────┐     │
        │  /onboard       │───────▶│  /dashboard     │     │
        │  5-step wizard  │ done   │  my guarded     │     │
        └─────────────────┘        │  agents         │     │
                                   └────────┬────────┘     │
                                            │ click agent   │
                                            ▼               │
                                   ┌─────────────────┐      │
                                   │ /agent/[id]     │◀─────┘ (deep link)
                                   │ detail + feed   │
                                   │ + rep chart     │
                                   └─────────────────┘

   ── public, no wallet ───────────────────────────────────────────
        ┌─────────────────┐        ┌─────────────────┐
        │  /watch         │        │  /leaderboard   │
        │  live demo wall │        │  ranked by rep  │
        │  (livestream)   │        │  (tweetable)    │
        └─────────────────┘        └─────────────────┘
```

**Route map**

| Route | Auth | Render | Purpose |
|---|---|---|---|
| `/` | public | SSR + client islands | Hero, live counters, recent-events panel |
| `/onboard` | wallet | client | Wrap an ERC-8004 agent (5 steps) |
| `/dashboard` | wallet | client | Operator's guarded agents |
| `/agent/[id]` | public read / owner manage | SSR shell + client | One agent: status, feed, reputation |
| `/watch` | public | client (SSE) | Live demo wall for the stream |
| `/leaderboard` | public | SSR (ISR 60s) | All agents ranked by reputation |

Global chrome: a slim top `Nav` (wordmark left, links + ConnectButton right) and a
`Footer` (GitHub / X / Docs). Nav is hidden on `/watch` (full-bleed for projection).

---

## 3. Wireframes

ASCII is indicative, not pixel-exact. Target dark mode `#0a0a0a` background throughout.

### 3.1 `/` — Landing (must fit above the fold at 1440×900)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▦ SENTINEL              Watch   Leaderboard   Docs      [ Connect ▸ ]  │  Nav (h-14)
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│        The circuit breaker for                                         │  text-hero (72)
│        autonomous AI agents.                                           │  Inter 700, white
│                                                                        │
│        Wrap your ERC-8004 agent. Sleep at night.                       │  text-lg gray-1
│                                                                        │
│        ┌────────────┐  ┌────────────┐  ┌────────────┐                 │  3 stat cells
│        │ 12         │  │ $48,210    │  │ 3          │                 │  text-4xl Mono
│        │ AGENTS     │  │ VALUE      │  │ BREAKERS   │                 │  count-up on load
│        │ GUARDED    │  │ LOCKED     │  │ TRIPPED    │                 │  label xs gray-1
│        └────────────┘  └────────────┘  └────────────┘                 │
│                                                                        │
│        [ Connect Wallet ▸ ]   View the live wall →                    │  blue CTA + link
│                                                                        │
├──────────────────────────────────────────────────────────────────────┤
│  WATCH SENTINEL                                          ● live        │  section label
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ 14:02:11  agent 0x9a3f…  executed  → Merchant Moe   [ ↗ scan ] │    │  3 recent
│  │ 14:01:54  agent 0x7c20…  guarded   rules set         [ ↗ scan ]│    │  events,
│  │ 13:58:02  agent 0x9a3f…  ⚠ tx-rate 41/50 this hour  [ ↗ scan ] │    │  mono rows
│  └──────────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│  HOW IT WORKS   wrap → watch → pause → rescue   (4 short cells)        │  explainer
├──────────────────────────────────────────────────────────────────────┤
│  GitHub   X   Docs                                Built on Mantle      │  Footer
└──────────────────────────────────────────────────────────────────────┘
```

- Counters animate up via `react-countup` (client island). Source: §6.
- "WATCH SENTINEL" panel = last 3 events across all guarded agents, polled (5s) or SSE.
- Connect → RainbowKit modal. On success: redirect (§5) — `/onboard` if the address owns
  zero guarded agents, else `/dashboard`.
- Below-fold "HOW IT WORKS" is four terse cells; no marketing fluff.

### 3.2 `/onboard` — 5-step wizard

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▦ SENTINEL                                              [ 0x7c…20 ▾ ]  │
├──────────────────────────────────────────────────────────────────────┤
│   ① Select ── ② Rules ── ③ Deposit ── ④ Confirm ── ⑤ Done             │  Stepper
│   ●━━━━━━━━━━━━○──────────○──────────○──────────○                      │  blue = active
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   STEP 2 · CONFIGURE SAFETY RULES                                      │
│                                                                        │
│   Max drawdown            [ 10 ] %      stop if value drops this much  │  slider+input
│   Max tx / hour           [ 50 ]        rate cap                        │
│   Oracle deviation        [  5 ] %      price-feed sanity gap          │
│   Daily volume cap        [ $10,000 ]   USD moved per 24h              │
│   Active hours (UTC)      [ 09 ]–[ 21 ] off-hours → warn only         │
│   Allowed protocols       [ + Merchant Moe ] [ + Agni ] [ +add… ]     │  chips
│                                                                        │
│                            [ Back ]            [ Continue ▸ ]          │
└──────────────────────────────────────────────────────────────────────┘
```

Steps:
1. **Select agent** — list ERC-8004 NFTs owned by the connected address (read
   `MockIdentityRegistry` / ERC-8004 registry: `balanceOf` + token enumeration + `tokenURI`
   for image/name). If none → "Mint one at the Mantle ERC-8004 Registry" CTA (external).
2. **Rules** — the six `SafetyRules` fields with smart defaults pre-filled (10% / 50 / 5% /
   $10k / 09–21 UTC / common Mantle DEXes). Each field has a one-line plain-English helper.
3. **Deposit** — pick token (MNT, mETH, USDY, USDe, USDT0), amount; approve + deposit. Use
   ERC-20 permit where supported, else 2-tx approve→deposit with clear progress.
4. **Confirm** — review card of everything; one action: deploy `SafetyRules` instance →
   `AgentRegistry.register` → activate guard. Multicall if the wallet supports it, else a
   guided tx sequence with per-tx state.
5. **Done** — success card: agent dashboard link, "View on Mantlescan", X share template.

Validation: `react-hook-form` + `zod`. Each step is its own component; wizard state in a
zustand store so refresh/back doesn't lose input (§4). Every async action has a skeleton/
spinner and a friendly error (never a raw revert string — map custom errors, §6).

### 3.3 `/dashboard` — operator's agents

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▦ SENTINEL          Dashboard  Watch  Leaderboard      [ 0x7c…20 ▾ ]  │
├──────────────────────────────────────────────────────────────────────┤
│  YOUR AGENTS                                          [ + Wrap agent ] │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ● Arbitrage-7        0x9a3f…   guarded    rep 812   $24,100  →  │  │  row =
│  │ ⚠ Yield-Hopper       0x7c20…   warn       rep 640   $11,400  →  │  │  status dot +
│  │ ✕ Sniper-3 (PAUSED)  0x4d11…   tripped    rep 410   $ 8,710  →  │  │  name/addr/
│  └────────────────────────────────────────────────────────────────┘  │  rep/value
│                                                                        │
│  PORTFOLIO    total guarded $44,210   ·   3 agents   ·   1 alert       │  summary strip
└──────────────────────────────────────────────────────────────────────┘
```

- Reads agents owned by the connected address from `AgentRegistry` (`AgentGuarded` events
  filtered by owner, or `getAgentOwner` over a candidate set). Empty state → big "Wrap your
  first agent" CTA to `/onboard`.
- Status dot color = derived state (§6). A paused/tripped agent shows the only red on the
  page. Row click → `/agent/[id]`.

### 3.4 `/agent/[id]` — agent detail

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◀ Dashboard                                            [ 0x7c…20 ▾ ]  │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────┐  Arbitrage-7                          ● GUARDED           │
│  │ [NFT]  │  0x9a3f…e21   ERC-8004 #142            rep 812 / 1000     │  header
│  │  img   │  owner 0x7c…20                         [ Manage ⚙ ]       │  (owner only)
│  └────────┘                                                            │
├───────────────────────────────┬────────────────────────────────────┤
│  REPUTATION                    │  SAFETY RULES (read-only)            │
│   1000┤            ╭─╮         │   drawdown        10%                │
│        │      ╭────╯  ╰──      │   tx/hour         50                 │  config grid,
│        │ ╭────╯               │   oracle dev      5%                 │  Mono values
│    400 ┼─╯                    │   volume/day      $10,000            │
│        └────────────────────  │   hours (UTC)     09–21              │
│         sparkline (recharts)   │   protocols       Moe, Agni (2)      │
├───────────────────────────────┴────────────────────────────────────┤
│  DECISION FEED                                          last 50       │
│  14:02:11  executed   → Merchant Moe        value 1.2 MNT   [↗]      │
│  13:58:02  ⚠ warn     tx-rate 41/50                          [↗]      │
│  11:20:44  guarded    rules deployed                         [↗]      │
│  …                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

- Identity: ERC-8004 `tokenURI` → image + name. Reputation: `getReputation(agent)` for
  current score; `getAgentHistory(agent, 0, 50)` → sparkline series (recharts `LineChart`).
- Rules: read the agent's `SafetyRules` instance scalars + folded protocol allowlist.
- Decision feed: merge of `SentinelGuard` events (`AgentExecuted`, `CircuitBreakerTriggered`,
  `FundsRescued`, paused/unpaused) + monitor warn events. Newest first, mantlescan links.
- **Manage** (owner only, gated by `getAgentOwner == connected`): modal to edit rules,
  `ownerPauseAgent`, `unpauseAgent`, `rescueToSafety`. Destructive actions confirm first.
- If paused: a red banner pins to the top of the page until unpaused.

### 3.5 `/watch` — live demo wall (centerpiece, full-bleed)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▦ SENTINEL · LIVE          12 guarded   $48,210   3 tripped   🔇 mute │  stats bar
├───────────────────────────────────────────────┬──────────────────────┤
│  EVENT STREAM                                   │  WATCHED AGENTS      │
│  ┌───────────────────────────────────────────┐ │  ┌────────────────┐ │
│  │ ╳ CIRCUIT BREAKER · 0x4d11  drawdown -38%  │ │  │ ◔ Arb-7    grn │ │  dials:
│  │   funds rescued → vault   9s               │ │  │ ◑ Yield    amb │ │  green/
│  ├───────────────────────────────────────────┤ │  │ ◕ Sniper   red │ │  amber/
│  │ ⚠ WARN · 0x7c20  tx-rate 47/50             │ │  │ ◔ Maker-2  grn │ │  red
│  ├───────────────────────────────────────────┤ │  └────────────────┘ │
│  │ → EXEC · 0x9a3f  Merchant Moe  1.2 MNT     │ │                      │
│  ├───────────────────────────────────────────┤ │  feed: SSE /events   │
│  │ ＋ GUARDED · 0x55ab  rules set             │ │  reconnects auto     │
│  └───────────────────────────────────────────┘ │                      │
└───────────────────────────────────────────────┴──────────────────────┘
```

- No wallet needed. Real-time via **SSE** to a new `monitor` endpoint `GET /events`
  (added in 4.4 next to the existing `/health`). Client falls back to contract-event
  polling if SSE drops.
- Cards animate in from the top (push down), keep last 20. Event card types: GUARDED,
  EXEC, WARN (amber), CIRCUIT BREAKER (red flash + shake + slide), RESCUED.
- Circuit-breaker card triggers a subtle alarm via `howler.js`, **muted by default**
  (toggle in stats bar, persisted to localStorage).
- Right rail: currently-active agents as small status dials (green/amber/red).
- Optimized for a 1080p projector; still responsive (rail collapses below the stream on
  mobile).

### 3.6 `/leaderboard` — ranked, tweetable

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▦ SENTINEL          Dashboard  Watch  Leaderboard      [ Connect ▸ ]  │
├──────────────────────────────────────────────────────────────────────┤
│  LEADERBOARD                          ranked by reputation · 12 agents │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ #1  ● Maker-2     0x55ab…   rep 940   12d clean   $9.1k   [↗]   │  │
│  │ #2  ● Arbitrage-7 0x9a3f…   rep 812    4d clean   $24.1k  [↗]   │  │
│  │ #3  ⚠ Yield-Hopper 0x7c20…  rep 640    warn       $11.4k  [↗]   │  │
│  │ …                                                               │  │
│  │ #11 ✕ Sniper-3    0x4d11…   rep 410    tripped    $8.7k   [↗]   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                            [ Share leaderboard on X ]  │
└──────────────────────────────────────────────────────────────────────┘
```

- SSR with ISR (revalidate 60s). For each guarded agent: `getReputation` + derived state +
  guarded value. Sort by score desc. Row → `/agent/[id]`.
- "Share on X" pre-fills a tweet with the top 3 + URL. OG image per `docs/BRAND.md`.

---

## 4. State management plan (zustand)

Server/chain data goes through **TanStack Query** (wagmi's built-in) — cached, refetched,
deduped. Zustand holds only **client/UI state that doesn't belong on the chain or in the URL**.

Three small stores in `web/lib/store/`:

```ts
// onboard-store.ts — wizard progress; survives step nav + refresh (persist)
interface OnboardStore {
  step: 1|2|3|4|5;
  selectedAgent?: Address;            // chosen ERC-8004 token
  rules: SafetyRulesForm;             // the 6 fields, defaulted
  deposit?: { token: Address; amount: bigint };
  setStep / patchRules / reset…
}

// watch-store.ts — live wall buffer + UI prefs
interface WatchStore {
  events: WallEvent[];                // ring buffer, cap 20
  muted: boolean;                     // persist to localStorage
  push(e: WallEvent): void;           // unshift + trim
  setMuted(b: boolean): void;
}

// ui-store.ts — cross-cutting UI (toasts route through radix, not here)
interface UiStore {
  manageModalAgent?: Address;         // which agent's Manage modal is open
  soundReady: boolean;                // howler init gate (needs user gesture)
}
```

Rules of thumb:
- **Chain reads/writes** → wagmi hooks + Query keys. Never copy chain data into zustand.
- **Wizard input** → `onboard-store` (persisted, so a refusal/refresh mid-flow is safe).
- **Ephemeral UI** (modals, mute, buffers) → zustand.
- **Shareable state** (which agent, leaderboard) → the URL, not a store.

---

## 5. Wallet connection (wagmi + viem + RainbowKit)

`web/lib/wagmi.ts`:

```ts
import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL!] } },
  blockExplorers: { default: { name: "Mantlescan", url: "https://explorer.sepolia.mantle.xyz" } },
  testnet: true,
});
// mantle (5000) defined the same way for the mainnet switch later.

export const wagmiConfig = getDefaultConfig({
  appName: "Sentinel",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,   // WalletConnect
  chains: [mantleSepolia],
  transports: { [mantleSepolia.id]: http() },
  ssr: true,
});
```

- **Providers** (`web/app/providers.tsx`, `"use client"`): `WagmiProvider` →
  `QueryClientProvider` → `RainbowKitProvider` (dark theme tuned to `sentinel-blue`).
  Mounted once in `app/layout.tsx`, wrapping `children`.
- **Connect UI**: RainbowKit `<ConnectButton />` in the Nav, restyled to brand (mono,
  square-ish, blue accent only on hover/active).
- **Post-connect routing**: a small client hook `useConnectRedirect()` watches
  `useAccount().isConnected`; on connect from `/`, query the user's guarded-agent count and
  `router.push('/onboard' | '/dashboard')`.
- **Wrong-network guard**: if `chainId !== 5003`, replace primary CTAs with a "Switch to
  Mantle Sepolia" button (`useSwitchChain`).
- **Gas (Mantle)**: writes must account for the L1 data fee. A `lib/gas.ts` helper wraps
  `estimateGas` + `eth_estimateL1Fee` so the Confirm step shows a realistic total in MNT
  (per CLAUDE.md Mantle gotchas). viem clients only — no ethers.

`.env` (web) additions, all `NEXT_PUBLIC_` since they hit the browser:
`NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL`, `NEXT_PUBLIC_WC_PROJECT_ID`,
`NEXT_PUBLIC_MONITOR_URL` (for `/events` SSE + `/health`).

---

## 6. Data layer (contracts → UI)

Addresses from `contracts/deployments/sepolia.json`; ABIs via `pnpm gen:abis` →
`web/lib/contracts.ts`. All reads use viem/wagmi; never hardcode RPC (CLAUDE.md hard rule).

**Live counters (`/`)**

| Metric | Source |
|---|---|
| Agents guarded | count of `AgentRegistry.AgentGuarded` − `AgentDeregistered` (or `isGuarded` over set) |
| Value locked (USD) | for each guarded agent: `SentinelGuard.getAgentTokens` → balances × Pyth price → Σ |
| Breakers tripped | count of `SentinelGuard.CircuitBreakerTriggered` |

**Events feed (`/`, `/agent`, `/watch`)** — decode these and map to UI rows:

| Event | UI label | Color |
|---|---|---|
| `AgentRegistry.AgentGuarded` | GUARDED | green |
| `SentinelGuard.AgentExecuted` | EXEC → target | neutral |
| monitor `warn` anomaly | WARN (type) | amber |
| `SentinelGuard.CircuitBreakerTriggered(agent, reason, ts)` | CIRCUIT BREAKER | red |
| `SentinelGuard.FundsRescued(agent, beneficiary, n)` | RESCUED → vault | red |
| `SentinelGuard.AgentPausedByOwner` / `AgentUnpaused` | PAUSED / RESUMED | red / neutral |

`reason` (bytes32) decodes to an `AnomalyType` (`MAX_DRAWDOWN`, `MAX_TX_PER_HOUR`,
`ALLOWED_PROTOCOLS`, `ORACLE_DEVIATION`, `DAILY_VOLUME`, `TIME_WINDOW`) via the shared
`keccak256(utf8(type))` map — same mapping the monitor uses, so labels stay consistent.

**Reputation (`/agent`, `/leaderboard`)** — `getReputation(agent) → {score, lastUpdated,
eventCount, initialized}`; history via `getAgentHistory(agent, offset, limit)` whose
`EventType` enum is `{CleanDay, RuleViolation, CircuitBreaker, SuccessfulRecovery,
SlashingEvent}` → sparkline points.

**Derived agent status** (one helper, used everywhere for the dot/dial color):

```
isPaused (guard)            → red    "tripped/paused"
any live warn anomaly       → amber  "warn"
guarded & no warn           → green  "guarded"
not guarded                 → gray   "—"
```

**SafetyRules display/edit** — read scalars `maxDrawdownBps`, `maxTxPerHour`,
`oracleDeviationBps`, `dailyVolumeCapUsd`, `timeOfDayMin/Max`, plus `allowedProtocolCount`
and folded `ProtocolAllowlistChanged` history for the chip list.

**Friendly errors** — map `SentinelGuard` custom errors to copy (CLAUDE.md: never show raw
reverts): `CooldownActive(readyAt)` → "Cooling down — try again in Ns."; `AgentIsPaused`
→ "This agent is paused."; `NotAgentOwner` → "Only the owner can do this."; etc. One
`lib/errors.ts` mapping table.

**Monitor SSE** — `/watch` connects to `NEXT_PUBLIC_MONITOR_URL/events` (SSE, added in
4.4). Message = JSON `WallEvent`. Auto-reconnect with backoff; on hard fail, fall back to
contract-log polling so the wall never goes fully dark.

---

## 7. Component inventory

`web/components/ui/` is currently **empty** — the radix deps are installed but the shadcn
component files are not generated yet. Add via `pnpm dlx shadcn@latest add …`.

**shadcn/ui to add** (radix dep already present for each):
`button`, `card`, `input`, `label`, `select`, `switch`, `slider`, `dialog`,
`dropdown-menu`, `tabs`, `toast` (+ `toaster`/`use-toast`), `tooltip`, `badge`, `skeleton`,
`separator`, `form` (RHF wrapper), `stepper`*.

\* shadcn has no canonical stepper — build `components/ui/stepper.tsx` on radix primitives
or a small custom component.

**Custom (brand) components** — `web/components/`:

| Component | Used by | Notes |
|---|---|---|
| `Nav` / `Footer` | all (not /watch) | wordmark + links + ConnectButton |
| `Wordmark` | nav, footer, OG | renders `logo-full.svg` / mark |
| `ConnectButton` | nav | restyled RainbowKit button |
| `StatCounter` | `/`, `/watch` | `react-countup` + mono label |
| `StatusDot` / `StatusDial` | dashboard, agent, watch | green/amber/red, one source of truth |
| `EventRow` / `EventCard` | `/`, `/agent`, `/watch` | shared event renderer; card = animated variant |
| `AddressLink` | everywhere | truncated mono addr + mantlescan link |
| `ReputationBadge` | agent, leaderboard | score / 1000 + tier color |
| `ReputationSparkline` | `/agent` | recharts `LineChart`, no axes chrome |
| `RuleField` | onboard, manage modal | slider+input+helper, RHF-bound |
| `RulesSummary` | `/agent`, confirm step | read-only grid |
| `AgentRow` | dashboard, leaderboard | status + name + addr + rep + value |
| `CircuitBreakerAlert` | `/watch` | the one dramatic animation (flash/shake) |
| `WalletGuard` | onboard, dashboard | gates on connected + correct chain |
| `OnboardStepper` + 5 step components | `/onboard` | in `components/onboard/` |

**Libraries already installed** (package.json): `recharts`, `react-countup`, `howler`,
`zustand`, `lucide-react`, `clsx` + `tailwind-merge` (`cn`), `class-variance-authority`,
wagmi/viem/rainbowkit/react-query. **To add**: `react-hook-form` + `zod` +
`@hookform/resolvers` (onboarding), `@vercel/og` (OG image / 4.2). No other state lib.

---

## 8. Proposed `/web` file structure

```
web/
  app/
    layout.tsx                 # html.dark + <Providers> + Nav/Footer slot
    providers.tsx              # "use client" wagmi/query/rainbowkit
    page.tsx                   # / landing
    onboard/page.tsx
    dashboard/page.tsx
    agent/[id]/page.tsx
    watch/page.tsx
    leaderboard/page.tsx
    api/og/route.tsx           # @vercel/og (4.2)
  components/
    ui/                        # shadcn primitives (to generate)
    onboard/                   # 5 step components + stepper
    *.tsx                      # custom brand components (§7)
  lib/
    wagmi.ts                   # chains + config
    contracts.ts              # generated ABIs + addresses (gen:abis)
    store/{onboard,watch,ui}-store.ts
    status.ts                  # derived agent status helper
    errors.ts                  # custom-error → friendly copy
    gas.ts                     # L2 + L1 fee estimate (Mantle)
    pyth.ts                    # price fetch for USD value (reuse monitor logic)
    utils.ts                   # cn() (exists)
  public/                      # logos (exist) + favicons/og assets (to add)
```

---

## 9. Responsive & accessibility

- **Mobile-first.** Landing and leaderboard stack to one column; dashboard rows become
  cards; onboarding is naturally single-column. `/watch` keeps the stream and collapses the
  agent rail beneath it.
- **Contrast.** White-on-black body easily passes AA; gray-1 reserved for secondary text at
  ≥14px. Status never communicated by color alone — pair each dot with a glyph/label
  (`●/⚠/✕`) for colorblind users.
- **Focus.** Visible `sentinel-blue` focus rings (already the `--ring` token). Full keyboard
  path through the wizard; Stepper announces step via `aria-current`.
- **Motion.** Respect `prefers-reduced-motion`: disable count-up, card slides, and the
  breaker shake (keep the color/state change).
- **Sound.** Muted by default; only enabled after an explicit user gesture (autoplay
  policy) and persisted.

---

## 10. Build order for Phase 4 (maps to prompts)

1. **Foundation** (pre-4.2): providers, `wagmi.ts`, `gen:abis` → `contracts.ts`, Nav/Footer,
   generate shadcn primitives, `status.ts` + `errors.ts`.
2. **4.2** — `/` landing + live counters + recent-events panel + OG route. Deploy to Vercel.
3. **4.3** — `/onboard` wizard (5 steps, RHF+zod, zustand store).
4. **4.4** — `/watch` + monitor `/events` SSE endpoint.
5. **4.5** — `/agent/[id]` + `/leaderboard`. `/dashboard` lands with 4.5 (shares AgentRow).

---

*End of design. No code written. Proceed to PROMPT 4.2 on approval.*
