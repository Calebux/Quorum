import { NextRequest, NextResponse } from 'next/server';
import { IntentManifest } from '../../../../types/intent';
import { QuorumClient } from '../../../../quorum-client';
import { broadcastEvent } from '../stream/emitter';
import { buildPaymentRequired, verifyPayment } from '../../../../lib/x402';

const quorum = new QuorumClient({ network: 'testnet' });

export async function POST(req: NextRequest) {
  // x402 payment gate — 0.01 USDC on Stellar testnet per verification call
  const paymentHeader = req.headers.get('X-PAYMENT');
  const requirement   = buildPaymentRequired(req.url);
  const payment       = await verifyPayment(paymentHeader, requirement);

  if (!payment.valid) {
    return new Response(JSON.stringify({
      error:  'Payment Required',
      reason: payment.reason,
      x402:   requirement,
    }), {
      status:  402,
      headers: {
        'Content-Type':       'application/json',
        'X-PAYMENT-REQUIRED': JSON.stringify(requirement),
      },
    });
  }

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
          proposalId:  verdict.proposalId,
          arbiterId:   verdict.arbiterId,
          arbiterRole: verdict.arbiterId.includes('intent') ? 'Intent'
                     : verdict.arbiterId.includes('param')  ? 'Parameter'
                     : 'Adversarial',
          decision:    verdict.decision,
          confidence:  verdict.confidence,
          flags:       verdict.flags,
          reasoning:   verdict.reasoning,
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
