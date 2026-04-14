import { IntentManifest, RiskTier } from '../types/intent';
import { RiskAssessment } from '../types/risk';

const HIGH_SCRUTINY_THRESHOLD_XLM = 10_000;
const STANDARD_THRESHOLD_XLM      = 1_000;

const HIGH_RISK_PROTOCOLS = ['bridge', 'cross-chain', 'leverage'];
const STANDARD_RISK_ACTIONS = ['lend', 'borrow', 'stake'] as const;

export function assessRisk(manifest: IntentManifest): RiskAssessment {
  const reasons: string[] = [];
  let tierScore = 0;  // 0 = fast, 1 = standard, 2 = high-scrutiny

  const amount = parseFloat(manifest.amount);
  if (amount >= HIGH_SCRUTINY_THRESHOLD_XLM) {
    tierScore = Math.max(tierScore, 2);
    reasons.push(`Amount ${amount} XLM exceeds high-scrutiny threshold`);
  } else if (amount >= STANDARD_THRESHOLD_XLM) {
    tierScore = Math.max(tierScore, 1);
    reasons.push(`Amount ${amount} XLM exceeds standard threshold`);
  }

  if (HIGH_RISK_PROTOCOLS.some(p => manifest.protocol.toLowerCase().includes(p))) {
    tierScore = Math.max(tierScore, 2);
    reasons.push(`Protocol "${manifest.protocol}" is classified as high-risk`);
  }

  if ((STANDARD_RISK_ACTIONS as readonly string[]).includes(manifest.action)) {
    tierScore = Math.max(tierScore, 1);
    reasons.push(`Action "${manifest.action}" requires standard verification`);
  }

  const timeToDeadline = manifest.deadline - Math.floor(Date.now() / 1000);
  if (timeToDeadline < 30) {
    tierScore = Math.max(tierScore, 2);
    reasons.push(`Deadline is only ${timeToDeadline}s away — possible time-pressure manipulation`);
  }

  if (manifest.maxSlippage > 0.05) {
    tierScore = Math.max(tierScore, 1);
    reasons.push(`Max slippage ${manifest.maxSlippage * 100}% is above recommended 5%`);
  }

  const tiers: RiskTier[] = ['fast', 'standard', 'high-scrutiny'];
  const tier = tiers[tierScore];

  const config: Record<RiskTier, { arbiters: number; approvals: number }> = {
    'fast':           { arbiters: 1, approvals: 1 },
    'standard':       { arbiters: 2, approvals: 2 },
    'high-scrutiny':  { arbiters: 3, approvals: 2 },
  };

  return {
    tier,
    requiredArbiters:  config[tier].arbiters,
    requiredApprovals: config[tier].approvals,
    reasons,
  };
}
