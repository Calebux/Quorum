// aegis/src/lib/quorum-bridge.ts
// Drop this file into any Aegis project to add Quorum verification

import { QuorumClient } from '../quorum-client';
import { IntentManifest } from '../types/intent';
import { Keypair } from '@stellar/stellar-sdk';

const quorum = new QuorumClient({ network: 'testnet' });

/**
 * Call this in Aegis before executing any on-chain action.
 * Pass the Scribe's recommendation and the original user prompt.
 */
export async function verifyWithQuorum(params: {
  action:          IntentManifest['action'];
  fromAsset:       string;
  toAsset:         string;
  amount:          string;
  protocol:        string;
  protocolAddress: string;
  maxSlippage:     number;
  deadline:        number;
  minReceived:     string;
  humanPrompt:     string;
  agentReasoning:  string;
  agentId:         string;
  agentKeypair:    Keypair;
}): Promise<{ approved: boolean; executionTxHash?: string; rejectionReasons?: string[] }> {
  const manifest = quorum.buildManifest({ ...params, network: 'testnet' });
  const decision = await quorum.propose(manifest);

  if (decision.outcome === 'approved') {
    return { approved: true, executionTxHash: decision.executionTxHash };
  }

  return {
    approved: false,
    rejectionReasons: decision.verdicts
      .filter(v => v.decision === 'reject')
      .flatMap(v => v.flags),
  };
}
