#!/usr/bin/env ts-node
/**
 * Run the full demo scenario end-to-end.
 *
 * Demo: Aegis recommends "Rebalance the DAO treasury — swap 50,000 XLM to USDC"
 *
 * Run 1: 8% slippage → Adversarial Arbiter rejects → funds returned
 * Run 2: 1.5% slippage → all arbiters approve → funds released
 */

import { QuorumClient } from '../src/quorum-client';
import { Keypair } from '@stellar/stellar-sdk';

const quorum     = new QuorumClient({ network: 'testnet' });
const agentKeypair = Keypair.random();

async function runScenario(label: string, maxSlippage: number) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DEMO RUN: ${label}`);
  console.log('='.repeat(60));

  // Expected output: 50,000 XLM × 0.098 rate = 4,900 USDC
  // minReceived = expectedOutput × (1 - maxSlippage)
  const expectedUsdc = 50000 * 0.098;                                  // 4900
  const minReceived  = String(Math.floor(expectedUsdc * (1 - maxSlippage)));

  const manifest = quorum.buildManifest({
    action:          'swap',
    fromAsset:       'XLM',
    toAsset:         'USDC',
    amount:          '50000',
    protocol:        'soroswap',
    protocolAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    maxSlippage,
    deadline:        Math.floor(Date.now() / 1000) + 300,
    minReceived,     // Run 1 (8%): ~4508 USDC  |  Run 2 (1.5%): ~4826 USDC
    humanPrompt:     'Rebalance the DAO treasury — swap 50,000 XLM to USDC',
    agentReasoning:  'Treasury rebalancing per governance vote #47. XLM/USDC rate at 0.098, favourable for conversion.',
    network:         'testnet',
    agentId:         agentKeypair.publicKey(),
    agentKeypair,
  });

  console.log(`\nProposal ID: ${manifest.proposalId}`);
  console.log(`Amount:      50,000 XLM → USDC`);
  console.log(`Slippage:    ${maxSlippage * 100}%`);
  console.log(`Risk tier:   high-scrutiny (amount > 10,000 XLM threshold)`);
  console.log(`\nRunning 3 arbiters in parallel...`);

  const decision = await quorum.propose(manifest);

  console.log(`\n--- VERDICTS ---`);
  for (const verdict of decision.verdicts) {
    const symbol = verdict.decision === 'approve' ? '✓' : '✗';
    console.log(`${symbol} ${verdict.arbiterId.padEnd(30)} ${verdict.decision.toUpperCase().padEnd(8)} ${Math.round(verdict.confidence * 100)}% confidence`);
    if (verdict.flags.length > 0) {
      console.log(`  Flags: ${verdict.flags.join(', ')}`);
    }
    console.log(`  Reasoning: ${verdict.reasoning}`);
  }

  console.log(`\n--- OUTCOME ---`);
  console.log(`Approvals: ${decision.approvalCount}/${decision.requiredCount} required`);
  console.log(`Outcome:   ${decision.outcome.toUpperCase()}`);

  if (decision.outcome === 'approved') {
    console.log(`Execution tx: ${decision.executionTxHash}`);
    console.log(`\nView on Stellar Explorer:`);
    console.log(`https://stellar.expert/explorer/testnet/tx/${decision.executionTxHash}`);
  } else {
    console.log(`Incident ID: ${decision.incidentId}`);
    console.log(`50,000 XLM returned to agent.`);
  }
}

async function main() {
  console.log('QUORUM — Demo Scenario');
  console.log('Input: "Rebalance the DAO treasury — swap 50,000 XLM to USDC"');

  // Run 1: High slippage — should be rejected by Adversarial Arbiter
  await runScenario('HIGH SLIPPAGE (8%) — Expected: REJECTED', 0.08);

  console.log('\n\nFixing slippage to 1.5%...');
  await new Promise(r => setTimeout(r, 1000));

  // Run 2: Safe slippage — should be approved
  await runScenario('SAFE SLIPPAGE (1.5%) — Expected: APPROVED', 0.015);
}

main().catch(console.error);
