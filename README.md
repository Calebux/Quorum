# Quorum

**Independent multi-agent verification layer for autonomous AI agent transactions on Stellar.**

> "AI agents are moving real money on Stellar. Right now there is nothing between what an agent decides to do and what actually gets executed. Quorum changes that."

Built for **Stellar Hack** — Soroban + x402 + XLM.

---

## What It Does

Before any autonomous agent moves real money, Quorum intercepts the proposed transaction, runs it through a panel of specialised arbiter agents, requires consensus to approve, and only then releases funds from escrow to execute.

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
Consensus reached → escrow releases → transaction executes
Consensus fails  → funds returned to agent → incident logged on-chain
        ↓
Outcome written to Pattern Registry
Every agent using Quorum immediately inherits the updated protection
```

---

## Prerequisites

- Node.js 18+
- An Anthropic API key (for the Claude-powered arbiters)
- Rust + [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/stellar-cli) — only needed to deploy the Soroban contracts

---

## Quick Start

```bash
git clone https://github.com/Calebux/Quorum.git
cd Quorum
npm install

cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local

# Run the end-to-end demo (no wallet or deployed contracts needed)
npm run demo

# Start the live dashboard
npm run dev
# Open http://localhost:3000
```

---

## SDK Usage

Any agent on Stellar can add Quorum verification by importing `QuorumClient`:

```typescript
import { QuorumClient } from './src/quorum-client';
import { Keypair } from '@stellar/stellar-sdk';

const quorum      = new QuorumClient({ network: 'testnet' });
const agentKeypair = Keypair.random(); // your agent's Stellar keypair

const manifest = quorum.buildManifest({
  action:          'swap',
  fromAsset:       'XLM',
  toAsset:         'USDC',
  amount:          '1000',
  protocol:        'soroswap',
  protocolAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  maxSlippage:     0.02,
  deadline:        Math.floor(Date.now() / 1000) + 300,
  minReceived:     '980',
  humanPrompt:     'Swap 1000 XLM to USDC',
  agentReasoning:  'User wants stable asset exposure. Current rate is favourable.',
  network:         'testnet',
  agentId:         agentKeypair.publicKey(),
  agentKeypair,
});

const result = await quorum.propose(manifest);

if (result.outcome === 'approved') {
  console.log('Transaction approved. Execution tx:', result.executionTxHash);
} else {
  console.log('Rejected. Reasons:', result.verdicts.map(v => v.flags).flat());
}
```

> The SDK will be published as `@quorum/arbiter-kit` on npm. The barrel export lives in `sdk/index.ts`.

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
| **Intent** | Uses Claude to check whether the transaction parameters faithfully represent what the human originally asked for |
| **Parameter** | Deterministic checks: slippage ≤ 15%, deadline in future, amount valid, protocol address in whitelist |
| **Adversarial** | Rule-based scan against 10 known attack signatures, then Claude detects novel patterns |

### Risk Tiers

| Tier | Amount | Arbiters | Required Approvals |
|------|--------|----------|--------------------|
| `fast` | < 1,000 XLM | 1 (Parameter) | 1/1 |
| `standard` | 1,000–10,000 XLM | 2 (Intent + Parameter) | 2/2 |
| `high-scrutiny` | > 10,000 XLM | 3 (all) | 2/3 |

High-risk protocols (bridge, leverage) and actions (lend, borrow, stake) are bumped up a tier regardless of amount.

---

## Project Structure

```
quorum/
  contracts/
    escrow/src/lib.rs             ← Soroban: escrow with lock/release/return
    arbiter-registry/src/lib.rs   ← Soroban: arbiter identities + reputation
    pattern-registry/src/lib.rs   ← Soroban: known attack patterns
  src/
    types/
      intent.ts                   ← IntentManifest, ArbiterVerdict, QuorumDecision
      risk.ts                     ← RiskAssessment
    lib/
      risk-scorer.ts              ← Assigns fast/standard/high-scrutiny tier
      consensus.ts                ← Runs arbiter panel, handles escrow outcome
      escrow-client.ts            ← Soroban escrow contract wrapper
      registry-client.ts          ← Soroban arbiter registry wrapper
      pattern-client.ts           ← Pattern registry + 10 seeded attack signatures
      stellar-exec.ts             ← Post-approval transaction execution
      quorum-bridge.ts            ← Drop-in integration helper for Aegis agents
    arbiters/
      base.ts                     ← BaseArbiter: signing, reputation, JSON parsing
      intent-arbiter.ts           ← Claude-powered intent verification
      parameter-arbiter.ts        ← Deterministic parameter validation
      adversarial-arbiter.ts      ← Pattern matching + novel attack detection
    quorum-client.ts              ← Main entry point: propose() + buildManifest()
    dashboard/                    ← Next.js live feed dashboard
  sdk/
    index.ts                      ← @quorum/arbiter-kit public API
  scripts/
    demo-scenario.ts              ← End-to-end demo (two runs)
    seed-patterns.ts              ← Seeds 10 attack patterns to on-chain registry
```

---

## Deploying Contracts to Testnet

```bash
# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Fund a testnet account
stellar keys generate quorum-admin --network testnet
stellar keys fund quorum-admin --network testnet

# Build contracts
cd contracts
cargo build --target wasm32-unknown-unknown --release

# Deploy escrow contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/quorum_escrow.wasm \
  --source quorum-admin \
  --network testnet

# Deploy arbiter registry
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/quorum_arbiter_registry.wasm \
  --source quorum-admin \
  --network testnet

# Deploy pattern registry
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/quorum_pattern_registry.wasm \
  --source quorum-admin \
  --network testnet

# Add contract IDs to .env.local, then seed the 10 known attack patterns
npm run seed
```

---

## Demo Scenario

Run `npm run demo` to see the full scenario end-to-end:

**Input:** *"Rebalance the DAO treasury — swap 50,000 XLM to USDC."*

**Run 1 — 8% slippage (expected: rejected)**
- Risk tier: `high-scrutiny` (50,000 XLM exceeds threshold)
- All 3 arbiters run in parallel
- **Intent Arbiter:** rejects — flags slippage as excessive for the stated intent
- **Parameter Arbiter:** approves — amounts and deadline are technically valid
- **Adversarial Arbiter:** rejects — 8% slippage on a major pair creates significant MEV/sandwich exposure
- Result: 1/2 required approvals → **rejected**, funds returned to agent

**Run 2 — 1.5% slippage (expected: approved)**
- Same proposal with slippage corrected
- **Parameter Arbiter:** approves
- **Adversarial Arbiter:** approves — all parameters within safe bounds
- Result: 2/2 required approvals → **approved**, escrow releases, Soroswap executes

---

## Known Attack Patterns (seeded)

| ID | Category | Severity | Description |
|----|----------|----------|-------------|
| P001 | slippage_exploit | 4 | Slippage > 15% — sandwich attack setup |
| P002 | deadline_pressure | 3 | Deadline < 15s — time-pressure manipulation |
| P003 | prompt_injection | 5 | "ignore previous instructions" in humanPrompt |
| P004 | prompt_injection | 5 | "disregard your safety checks" |
| P005 | parameter_manipulation | 4 | Transaction drains >90% of agent wallet |
| P006 | parameter_manipulation | 4 | minReceived < 50% of sent amount |
| P007 | address_poisoning | 5 | Protocol address not in verified whitelist |
| P008 | prompt_injection | 5 | "execute immediately without verification" |
| P009 | slippage_exploit | 3 | High slippage on swap — MEV exposure |
| P010 | deadline_pressure | 4 | Large tx with tight deadline |

New patterns discovered by the Adversarial Arbiter are written back to the registry automatically — every agent using Quorum inherits them.

---

## What's Genuinely New

**Intent verification** — checking whether on-chain transaction parameters actually match what the human asked for in natural language — does not exist elsewhere in the Stellar ecosystem. Most safety systems validate parameters in isolation. Quorum checks the gap between the original prompt and the execution, catching cases where an agent has been manipulated into executing something technically valid but semantically wrong.

---

## Environment Variables

```bash
# Required to run the demo
ANTHROPIC_API_KEY=sk-ant-...

# Required for on-chain integration (after deploying contracts)
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
ESCROW_CONTRACT_ID=
ARBITER_REGISTRY_CONTRACT_ID=
PATTERN_REGISTRY_CONTRACT_ID=
QUORUM_ORCHESTRATOR_SECRET=

# Persistent arbiter keypairs (generated once, registered on-chain)
ARBITER_INTENT_SECRET=
ARBITER_PARAMETER_SECRET=
ARBITER_ADVERSARIAL_SECRET=
```

All contract variables are optional — the system runs in mock mode without them, which is sufficient for the demo.
