import Anthropic from '@anthropic-ai/sdk';
import { Keypair } from '@stellar/stellar-sdk';
import { IntentManifest, ArbiterVerdict } from '../types/intent';
import { ArbiterRegistryClient } from '../lib/registry-client';
import { createHash } from 'crypto';

/**
 * Strip markdown code fences and extract the JSON object from a Claude response.
 * Claude sometimes wraps JSON in ```json ... ``` despite being told not to.
 */
export function extractJson(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Fallback: find the first { ... } block
  const braces = text.match(/\{[\s\S]*\}/);
  if (braces) return braces[0];
  return text.trim();
}

export abstract class BaseArbiter {
  abstract readonly id: string;
  abstract readonly speciality: 'intent' | 'parameter' | 'adversarial';
  abstract readonly keypair: Keypair;

  protected client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  abstract evaluate(manifest: IntentManifest): Promise<{
    decision:   'approve' | 'reject';
    confidence: number;
    reasoning:  string;
    flags:      string[];
  }>;

  async run(manifest: IntentManifest): Promise<ArbiterVerdict> {
    const result = await this.evaluate(manifest);

    const verdict: Omit<ArbiterVerdict, 'signature'> = {
      proposalId:  manifest.proposalId,
      arbiterId:   this.id,
      decision:    result.decision,
      confidence:  result.confidence,
      reasoning:   result.reasoning,
      flags:       result.flags,
      timestamp:   Date.now(),
    };

    const signature = this.sign(verdict);

    // Update reputation on-chain (non-blocking)
    ArbiterRegistryClient.updateReputation(this.id, result.decision === 'approve' ? 3 : 0).catch(
      err => console.warn(`[BaseArbiter] Reputation update failed: ${err}`)
    );

    return { ...verdict, signature };
  }

  private sign(verdict: Omit<ArbiterVerdict, 'signature'>): string {
    const signable = JSON.stringify({
      proposalId: verdict.proposalId,
      arbiterId:  verdict.arbiterId,
      decision:   verdict.decision,
      confidence: verdict.confidence,
      hash:       createHash('sha256').update(verdict.reasoning).digest('hex'),
      timestamp:  verdict.timestamp,
    });
    return this.keypair.sign(Buffer.from(signable, 'utf8')).toString('hex');
  }
}
