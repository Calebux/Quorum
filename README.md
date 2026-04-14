# Quorum

**Independent multi-agent verification layer for autonomous AI agent transactions on Stellar.**

> "AI agents are moving real money on Stellar. Right now there is nothing between what an agent decides to do and what actually gets executed. Quorum changes that."

Built for **Stellar Hack** — Soroban + x402 + XLM.

---

## What It Does

Before any autonomous agent moves real money, Quorum intercepts the proposed transaction, runs it through a panel of three specialised arbiter agents, requires 2/3 consensus to approve, and only then releases funds from escrow to execute.

```
Agent submits IntentManifest
        ↓
Risk Scorer assigns tier → fast / standard / high-scrutiny
        ↓
Escrow Contract locks funds on Stellar
        ↓
Arbiter Panel spins up (1–3 arbiters based on tier)
  ├── Intent Arbiter:      does the tx match what the human actually asked for?
  ├── Parameter Arbiter:   are slippage, amounts, deadlines, and addresses valid?
  └── Adversarial Arbiter: does this match any known attack pattern?
        ↓
2/3 arbiters approve → escrow releases → transaction executes
1/3 or 0/3 approve → funds returned to agent → incident logged on-chain
        ↓
Outcome written to Pattern Registry
Every agent using Quorum immediately inherits the updated protection
```

---

## Quick Start

```bash
npm install
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY and Stellar contract addresses

# Run the dashboard
npm run dev

# Run the demo scenario (no wallet needed — uses mock escrow)
npx ts-node scripts/demo-scenario.ts
```

---

## SDK Usage

Any agent on Stellar can add Quorum verification in 5 lines:

```typescript
import { QuorumClient } from '@quorum/arbiter-kit';

const quorum = new QuorumClient({ network: 'testnet' });

const manifest = quorum.buildManifest({
  action:          'swap',
  fromAsset:       'XLM',
  toAsset:         'USDC',
  amount:          '1000',
  protocol:        'soroswap',
  protocolAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  maxSlippage:     0.02,
  deadline:        Math.floor(Date.now() / 1000) + 300,
  minReceived:     '990',
  humanPrompt:     'Swap 1000 XLM to USDC',
  agentReasoning:  'User wants stable asset exposure.',
  network:         'testnet',
  agentId:         myAgent.sorobanId,
  agentKeypair:    myAgent.keypair,
});

const result = await quorum.propose(manifest);

if (result.outcome === 'approved') {
  console.log('Execution tx:', result.executionTxHash);
} else {
  console.log('Rejected:', result.verdicts.map(v => v.flags).flat());
}
```

---

## Architecture

### Soroban Contracts

| Contract | Purpose |
|----------|---------|
| `contracts/escrow` | Holds funds during verification. Releases on approval, returns on rejection. |
| `contracts/arbiter-registry` | On-chain identity + reputation for each arbiter |
| `contracts/pattern-registry` | Database of known adversarial attack patterns |

### Arbiters

| Arbiter | Role |
|---------|------|
| **Intent** | Checks the tx matches what the human originally asked for (natural language → on-chain params) |
| **Parameter** | Validates amounts, slippage ≤ 15%, deadline in future, protocol in whitelist |
| **Adversarial** | Scans against 10 known attack patterns + Claude detects novel ones |

### Risk Tiers

| Tier | Threshold | Arbiters | Required Approvals |
|------|-----------|----------|--------------------|
| `fast` | < 1,000 XLM | 1 (Parameter only) | 1/1 |
| `standard` | 1,000–10,000 XLM | 2 (Intent + Parameter) | 2/2 |
| `high-scrutiny` | > 10,000 XLM | 3 (all) | 2/3 |

---

## Project Structure

```
quorum/
  contracts/
    escrow/src/lib.rs             ← Soroban: escrow with lock/release/return
    arbiter-registry/src/lib.rs   ← Soroban: arbiter identities + reputation
    pattern-registry/src/lib.rs   ← Soroban: known attack patterns
  src/
    types/intent.ts               ← IntentManifest, ArbiterVerdict, QuorumDecision
    types/risk.ts                 ← RiskAssessment
    lib/
      risk-scorer.ts              ← Determines verification tier
      consensus.ts                ← Manages arbiter panel + escrow
      escrow-client.ts            ← Soroban escrow wrapper
      registry-client.ts          ← Soroban arbiter registry wrapper
      pattern-client.ts           ← Soroban pattern registry + 10 seed patterns
      stellar-exec.ts             ← Post-approval execution
      quorum-bridge.ts            ← Drop-in Aegis integration
    arbiters/
      base.ts                     ← BaseArbiter (signing, reputation updates)
      intent-arbiter.ts           ← Claude-powered intent verification
      parameter-arbiter.ts        ← Deterministic parameter validation
      adversarial-arbiter.ts      ← Pattern matching + novel attack detection
    quorum-client.ts              ← Main entry point
    dashboard/                    ← Next.js dashboard
  sdk/
    index.ts                      ← @quorum/arbiter-kit public API
  scripts/
    demo-scenario.ts              ← End-to-end demo (two runs)
    seed-patterns.ts              ← Seeds 10 attack patterns to registry
```

---

## Demo Scenario

**Input:** *"Rebalance the DAO treasury — swap 50,000 XLM to USDC."*

**Run 1 (8% slippage):**
- Risk tier: `high-scrutiny` (50,000 XLM > threshold)
- All 3 arbiters run in parallel
- Intent Arbiter: approve (matches treasury intent)
- Parameter Arbiter: approve (amounts valid)
- Adversarial Arbiter: **reject** — matches pattern P009 (high slippage on swap)
- Outcome: 2/3 approvals but adversarial flag → **rejected**, funds returned

**Run 2 (1.5% slippage):**
- Same setup, slippage fixed
- All 3 arbiters: approve
- Outcome: **approved**, escrow releases, Soroswap executes

---

## What's Genuinely New

**Intent verification** — checking whether on-chain transaction parameters actually match what the human asked for in natural language — does not exist elsewhere in the Stellar ecosystem. Most safety systems only check parameters (amounts, slippage). Quorum checks the gap between the prompt and the execution.

---

## Environment Variables

See `.env.example`. Minimum required to run the demo:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

All Stellar contract variables are optional — the system runs in mock mode without them, which is sufficient for demo purposes.
