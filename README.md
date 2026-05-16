# Sentinel — Agent Circuit Breaker for Mantle

> Auto-pause and rescue funds when your AI agent misbehaves.

Built for the **Mantle Turing Test Hackathon 2026** — Agentic Economy track.

## Live Contracts

| Contract | Network | Address |
|---|---|---|
| SentinelGuard | Mantle Sepolia | [`0x586448d146BcDD7FBb1F3dd8c3E7e0506cA46c0d`](https://explorer.sepolia.mantle.xyz/address/0x586448d146BcDD7FBb1F3dd8c3E7e0506cA46c0d) |

## What it does

Sentinel wraps ERC-8004 AI agents in a circuit-breaker vault. An off-chain monitor watches for anomalies (drawdown, rate limits, oracle deviation) and auto-pauses the contract — freezing agent activity without ever touching user funds. Only the owner can rescue assets after a pause.

## Stack

- **Contracts:** Solidity 0.8.24 + Foundry on Mantle Network
- **Monitor:** Node.js 20 + TypeScript + viem
- **Frontend:** Next.js 14 + Tailwind + wagmi + RainbowKit

## Quick start

```bash
# Contracts
cd contracts && forge build && forge test -vvv

# Monitor
cd monitor && pnpm dev

# Frontend
cd web && pnpm dev
```
