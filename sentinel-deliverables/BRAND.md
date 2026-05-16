# Sentinel — Brand Guidelines

## The name

**SENTINEL** — always uppercase in logo lockups. Sentence case ("Sentinel") in body copy.

A sentinel is a guard who stands watch. The word implies vigilance, silence, and protection without intrusion. It's a serious word for a serious product.

## The mark

A shield with a "broken circuit" line through the middle. Two short lines on either side of a center dot — the visual of a circuit being broken to stop current flow. The shield says "protection." The break says "circuit breaker."

Files:
- `logo-mark.svg` — shield only, 64×64. Use for favicon, app icon, X profile pic.
- `logo-full.svg` — shield + wordmark, 360×80. Use in headers, footers, READMEs.
- `logo-wordmark.svg` — wordmark only. Use when the mark would be redundant.

## Color

One color. Used sparingly.

| Token | Hex | Usage |
|---|---|---|
| `--sentinel-blue` | `#2563eb` | Mark accent, primary CTA, links, focus rings. NEVER as background fill. |
| `--sentinel-black` | `#0a0a0a` | Primary background in dark mode (default). |
| `--sentinel-white` | `#fafafa` | Primary text on black. Background in light mode. |
| `--sentinel-gray-1` | `#737373` | Secondary text, borders, dim states. |
| `--sentinel-gray-2` | `#262626` | Card backgrounds in dark mode, hover states. |
| `--sentinel-danger` | `#dc2626` | Reserved exclusively for circuit-breaker-triggered states. |

**Rules:**
- Dark mode is the default. The product looks like a Bloomberg terminal, not a marketing page.
- No gradients. No glows. No neon. No 3D.
- Blue accent appears on **at most 5%** of any given screen.
- Red is sacred — only for active alerts. Don't use it for buttons or decoration.

## Typography

### Display + UI: Inter

Used for everything visible to the user. Tight tracking, optical sizing.

```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
font-feature-settings: 'ss01', 'ss03'; /* Stylistic alternates for cleaner numerals */
```

Weights used: **400** (body), **500** (UI labels), **700** (headings).

### Monospace: JetBrains Mono

Used for the wordmark, data displays, hashes, addresses, code, anything technical.

```css
font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
```

Weights used: **400** (data), **700** (wordmark, emphasis).

### Type scale

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-xs` | 12px | 400 | Captions, metadata |
| `text-sm` | 14px | 400 | Body small |
| `text-base` | 16px | 400 | Body |
| `text-lg` | 18px | 500 | UI labels, lead paragraphs |
| `text-xl` | 24px | 500 | Subheadings |
| `text-2xl` | 32px | 700 | Section headings |
| `text-3xl` | 48px | 700 | Hero text |
| `text-4xl` | 72px | 700 | Hero number displays |

## Voice

The product speaks in **complete sentences. Short. Declarative.** No hype. No exclamation marks.

✅ "Sentinel monitors your agent and pauses it before damage compounds."
❌ "🚀 Sentinel is the next-gen on-chain safety layer for your AI agents!! 🛡️"

✅ "Funds rescued in 9 seconds."
❌ "OMG we just saved $84 with Sentinel!!! Incredible!"

✅ "Three contracts. One monitor. One reason it can only exist on Mantle."
❌ "Sentinel is a revolutionary new protocol leveraging cutting-edge blockchain technology..."

### Tone reference

Think: **Stripe documentation.** Confident, technical, doesn't waste your time.
Avoid: **Crypto Twitter.** Emojis, "WAGMI," 1000x predictions, vague promises.

## Words to use

- Wrap, guard, watch, pause, rescue, protect, monitor
- Anomaly, threshold, violation, trigger
- Agent, operator, owner, identity

## Words to never use

- "Safu," "WAGMI," "moon," "alpha leak"
- "Revolutionary," "game-changing," "next-gen"
- "Web3" (use "on-chain" instead)
- "Solution" (use what it actually does)
- "Empower," "unleash," "unlock potential"

## Logo usage rules

- **Minimum clear space:** equal to the height of the wordmark on all sides.
- **Minimum size:** 24px height for the mark alone, 32px for the full lockup.
- **Never:** rotate it, stretch it, add a glow, place on a busy background, recolor to anything other than the brand blue or pure white/black.

## OG image template

For social shares. 1200×630.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   [logo-full.svg, centered]                              │
│                                                          │
│   The circuit breaker for                                │
│   autonomous AI agents.                                  │
│                                                          │
│                                                          │
│   sentinel.guard                       ON MANTLE         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Background: `#0a0a0a`
- Headline: 64px Inter Bold, white
- URL + "ON MANTLE": 18px JetBrains Mono, gray-1
- Logo: full lockup, 280px wide

Generate with `@vercel/og` from `web/app/api/og/route.tsx`.

## App favicon

Use `logo-mark.svg`. Convert to:
- `favicon.ico` (32×32)
- `apple-touch-icon.png` (180×180, with 10% padding)
- `icon-192.png` and `icon-512.png` for PWA manifest

## Tailwind config snippet

Add to `web/tailwind.config.ts`:

```ts
extend: {
  colors: {
    sentinel: {
      blue: '#2563eb',
      black: '#0a0a0a',
      white: '#fafafa',
      'gray-1': '#737373',
      'gray-2': '#262626',
      danger: '#dc2626',
    },
  },
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
  },
  fontSize: {
    'hero': ['72px', { lineHeight: '1', fontWeight: '700' }],
  },
}
```

## Animation principles

- **Subtle.** Animations are 150-300ms. Anything longer feels slow on a financial UI.
- **Purposeful.** Animate to communicate state, never to decorate.
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` for everything. No bouncy easings.
- **Exception:** The circuit-breaker alert animation can be more dramatic (red flash, slide-in with shake) because the event itself is dramatic.

## The pinned tweet

> Always have one. Always have it be the launch thread or the latest demo video.
> Never let it expire to a generic "follow us for updates" tweet.
