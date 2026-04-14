import { RiskTier } from './intent';

export interface RiskAssessment {
  tier:               RiskTier;
  requiredArbiters:   number;    // 1, 2, or 3
  requiredApprovals:  number;    // minimum approvals needed
  reasons:            string[];  // why this tier was assigned
}
