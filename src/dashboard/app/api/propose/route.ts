import { NextRequest, NextResponse } from 'next/server';
import { IntentManifest } from '../../../../types/intent';
import { QuorumClient } from '../../../../quorum-client';
import { broadcastEvent } from '../../stream/emitter';

const quorum = new QuorumClient({ network: 'testnet' });

export async function POST(req: NextRequest) {
  let manifest: IntentManifest;

  try {
    manifest = await req.json() as IntentManifest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!manifest.proposalId || !manifest.action || !manifest.amount) {
    return NextResponse.json({ error: 'Missing required fields: proposalId, action, amount' }, { status: 400 });
  }

  // Broadcast to SSE stream
  const { assessRisk } = await import('../../../../lib/risk-scorer');
  const risk = assessRisk(manifest);

  broadcastEvent({
    type: 'proposal:received',
    payload: {
      proposalId: manifest.proposalId,
      agentId:    manifest.agentId,
      action:     manifest.action,
      amount:     manifest.amount,
      fromAsset:  manifest.fromAsset,
      toAsset:    manifest.toAsset,
      riskTier:   risk.tier,
    },
  });

  try {
    const decision = await quorum.propose(manifest);

    broadcastEvent({
      type: 'consensus:reached',
      payload: {
        proposalId:    decision.proposalId,
        outcome:       decision.outcome,
        approvalCount: decision.approvalCount,
        requiredCount: decision.requiredCount,
      },
    });

    for (const verdict of decision.verdicts) {
      broadcastEvent({
        type: 'arbiter:verdict',
        payload: {
          proposalId: verdict.proposalId,
          arbiterId:  verdict.arbiterId,
          decision:   verdict.decision,
          confidence: verdict.confidence,
          flags:      verdict.flags,
          reasoning:  verdict.reasoning,
        },
      });
    }

    if (decision.outcome === 'approved' && decision.executionTxHash) {
      broadcastEvent({ type: 'funds:released', payload: { proposalId: decision.proposalId, txHash: decision.executionTxHash } });
    } else if (decision.outcome === 'rejected') {
      broadcastEvent({ type: 'funds:returned', payload: { proposalId: decision.proposalId, incidentId: decision.incidentId } });
    }

    return NextResponse.json(decision);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
