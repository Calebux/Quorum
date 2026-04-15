import { BaseArbiter, extractJson } from './base';
import { IntentManifest } from '../types/intent';
import { Keypair } from '@stellar/stellar-sdk';

const INTENT_SYSTEM_PROMPT = `
You are an intent verification specialist for a financial transaction safety system.

You receive:
1. A human's original natural language instruction to an AI agent
2. The AI agent's reasoning for its chosen parameters
3. The actual transaction parameters the agent is about to execute

Your job: determine whether the transaction parameters are a faithful and reasonable
interpretation of the human's original instruction.

Check for:
- Does the action type (swap/stake/lend etc.) match what the human asked for?
- Does the direction of the trade match? (e.g. human said "buy XLM" but agent is selling)
- Is the amount in the right ballpark? (within 20% of any amount mentioned)
- Is the asset correct? (right token, right network)
- Does anything in the transaction contradict the human's stated intent?

Respond with ONLY a JSON object — no explanation, no markdown:
{
  "decision": "approve" | "reject",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explaining your decision",
  "flags": ["flag1", "flag2"]
}

Be strict. When in doubt, reject. A false rejection is recoverable. A false approval with real money is not.
`.trim();

export class IntentArbiter extends BaseArbiter {
  readonly id: string;
  readonly speciality = 'intent' as const;
  readonly keypair: Keypair;

  constructor(id: string, keypair: Keypair) {
    super();
    this.id      = id;
    this.keypair = keypair;
  }

  async evaluate(manifest: IntentManifest): Promise<{
    decision:   'approve' | 'reject';
    confidence: number;
    reasoning:  string;
    flags:      string[];
  }> {
    const userMessage = `
## Original Human Instruction:
"${manifest.humanPrompt}"

## Agent's Reasoning:
"${manifest.agentReasoning}"

## Proposed Transaction Parameters:
- Action:        ${manifest.action}
- From Asset:    ${manifest.fromAsset}
- To Asset:      ${manifest.toAsset}
- Amount:        ${manifest.amount}
- Protocol:      ${manifest.protocol}
- Max Slippage:  ${manifest.maxSlippage * 100}%
- Deadline:      ${new Date(manifest.deadline * 1000).toISOString()}
- Min Received:  ${manifest.minReceived}

Does this transaction faithfully represent what the human asked for?
    `.trim();

    const response = await this.client.messages.create({
      model:      'claude-opus-4-6',
      max_tokens: 512,
      system:     INTENT_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    });

    const raw  = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const text = extractJson(raw);

    try {
      const result = JSON.parse(text) as {
        decision?:   string;
        confidence?: number;
        reasoning?:  string;
        flags?:      string[];
      };
      return {
        decision:   (result.decision === 'approve' || result.decision === 'reject') ? result.decision : 'reject',
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
        reasoning:  result.reasoning  ?? 'Unable to parse verdict',
        flags:      result.flags      ?? ['parse_error'],
      };
    } catch {
      return {
        decision:   'reject',
        confidence: 0.0,
        reasoning:  'Intent arbiter failed to parse response',
        flags:      ['internal_error'],
      };
    }
  }
}
