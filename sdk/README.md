# @quorum/arbiter-kit

Independent multi-agent verification layer for autonomous AI agent transactions on Stellar.

## Install

```bash
npm install @quorum/arbiter-kit
```

## Usage

```typescript
import { QuorumClient } from '@quorum/arbiter-kit';
import { Keypair } from '@stellar/stellar-sdk';

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
  agentReasoning:  'User wants stable asset exposure. Current rate is favourable.',
  network:         'testnet',
  agentId:         myAgent.sorobanId,
  agentKeypair:    myAgent.keypair,
});

const result = await quorum.propose(manifest);

if (result.outcome === 'approved') {
  console.log('Transaction approved. Execution tx:', result.executionTxHash);
} else {
  console.log('Transaction rejected. Reasons:', result.verdicts.map(v => v.flags).flat());
}
```

## How It Works

1. **Risk Scorer** assigns a tier based on amount, protocol, and action type
2. **Escrow Contract** locks funds on Stellar/Soroban
3. **Arbiter Panel** (1–3 agents) verify the proposal in parallel
4. **2/3 consensus** required for high-scrutiny proposals
5. Approved: escrow releases funds for execution
6. Rejected: funds returned, incident logged on-chain

## Arbiters

| Arbiter | Checks |
|---------|--------|
| Intent | Does the tx match what the human asked for? |
| Parameter | Are amounts, slippage, deadlines, and addresses valid? |
| Adversarial | Does this match any known attack pattern? |
