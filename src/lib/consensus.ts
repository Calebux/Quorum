import { IntentManifest, ArbiterVerdict, QuorumDecision, RiskTier } from '../types/intent';
import { IntentArbiter } from '../arbiters/intent-arbiter';
import { ParameterArbiter } from '../arbiters/parameter-arbiter';
import { AdversarialArbiter } from '../arbiters/adversarial-arbiter';
import { EscrowClient } from './escrow-client';
import { assessRisk } from './risk-scorer';
import { StellarExec } from './stellar-exec';

export class ConsensusManager {
  private intentArbiter:     IntentArbiter;
  private parameterArbiter:  ParameterArbiter;
  private adversarialArbiter: AdversarialArbiter;

  constructor(
    intentArbiter:      IntentArbiter,
    parameterArbiter:   ParameterArbiter,
    adversarialArbiter: AdversarialArbiter,
  ) {
    this.intentArbiter      = intentArbiter;
    this.parameterArbiter   = parameterArbiter;
    this.adversarialArbiter = adversarialArbiter;
  }

  async process(manifest: IntentManifest): Promise<QuorumDecision> {
    const risk = assessRisk(manifest);
    const arbiterSelection = this.selectArbiters(risk.tier);

    // Run selected arbiters in parallel
    const verdicts: ArbiterVerdict[] = await Promise.all(
      arbiterSelection.map(arbiter => arbiter.run(manifest))
    );

    const approvalCount = verdicts.filter(v => v.decision === 'approve').length;
    const approved      = approvalCount >= risk.requiredApprovals;

    if (approved) {
      const txHash = await EscrowClient.releaseFunds(manifest.proposalId, manifest.protocolAddress);
      await StellarExec.execute(manifest, txHash);

      return {
        proposalId:      manifest.proposalId,
        outcome:         'approved',
        verdicts,
        approvalCount,
        requiredCount:   risk.requiredApprovals,
        riskTier:        risk.tier,
        executionTxHash: txHash,
        timestamp:       Date.now(),
      };
    } else {
      await EscrowClient.returnFunds(manifest.proposalId);
      const incidentId = await this.logIncident(manifest, verdicts);

      return {
        proposalId:    manifest.proposalId,
        outcome:       'rejected',
        verdicts,
        approvalCount,
        requiredCount: risk.requiredApprovals,
        riskTier:      risk.tier,
        incidentId,
        timestamp:     Date.now(),
      };
    }
  }

  private selectArbiters(tier: RiskTier) {
    switch (tier) {
      case 'fast':          return [this.parameterArbiter];
      case 'standard':      return [this.intentArbiter, this.parameterArbiter];
      case 'high-scrutiny': return [this.intentArbiter, this.parameterArbiter, this.adversarialArbiter];
    }
  }

  private async logIncident(manifest: IntentManifest, verdicts: ArbiterVerdict[]): Promise<string> {
    const incidentId = `INC-${Date.now()}-${manifest.proposalId.slice(0, 8)}`;
    console.log(`[Quorum] Incident logged: ${incidentId}`, {
      proposalId: manifest.proposalId,
      rejections: verdicts.filter(v => v.decision === 'reject').map(v => ({
        arbiterId: v.arbiterId,
        flags:     v.flags,
      })),
    });
    return incidentId;
  }
}
