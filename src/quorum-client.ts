import { IntentManifest, QuorumDecision } from './types/intent';
import { ConsensusManager } from './lib/consensus';
import { EscrowClient } from './lib/escrow-client';
import { IntentArbiter } from './arbiters/intent-arbiter';
import { ParameterArbiter } from './arbiters/parameter-arbiter';
import { AdversarialArbiter } from './arbiters/adversarial-arbiter';
import { Keypair } from '@stellar/stellar-sdk';
import { createHash } from 'crypto';

export interface QuorumConfig {
  network:    'testnet' | 'mainnet';
  rpcUrl?:    string;
}

export class QuorumClient {
  private consensusManager: ConsensusManager;
  private config: QuorumConfig;

  constructor(config: QuorumConfig) {
    this.config = config;

    // Derive a deterministic dev keypair from a role name so the public key
    // (and therefore on-chain reputation) is stable across restarts in dev mode.
    function devKeypair(role: string): Keypair {
      const seed = createHash('sha256').update(`quorum-dev-${role}`).digest();
      return Keypair.fromRawEd25519Seed(seed);
    }

    // Load keypairs from env if available, otherwise derive deterministic dev keypairs
    const intentKeypair = process.env.ARBITER_INTENT_SECRET
      ? Keypair.fromSecret(process.env.ARBITER_INTENT_SECRET)
      : devKeypair('intent');
    const parameterKeypair = process.env.ARBITER_PARAMETER_SECRET
      ? Keypair.fromSecret(process.env.ARBITER_PARAMETER_SECRET)
      : devKeypair('parameter');
    const adversarialKeypair = process.env.ARBITER_ADVERSARIAL_SECRET
      ? Keypair.fromSecret(process.env.ARBITER_ADVERSARIAL_SECRET)
      : devKeypair('adversarial');

    const intentArbiter      = new IntentArbiter(`arbiter-intent-${intentKeypair.publicKey().slice(0, 8)}`, intentKeypair);
    const parameterArbiter   = new ParameterArbiter(`arbiter-param-${parameterKeypair.publicKey().slice(0, 8)}`, parameterKeypair);
    const adversarialArbiter = new AdversarialArbiter(`arbiter-adv-${adversarialKeypair.publicKey().slice(0, 8)}`, adversarialKeypair);

    this.consensusManager = new ConsensusManager(
      intentArbiter,
      parameterArbiter,
      adversarialArbiter,
    );
  }

  /**
   * Submit a transaction proposal for verification.
   * Returns a QuorumDecision with outcome 'approved' or 'rejected'.
   */
  async propose(manifest: IntentManifest): Promise<QuorumDecision> {
    await EscrowClient.lockFunds(manifest);
    return this.consensusManager.process(manifest);
  }

  /**
   * Helper: build an IntentManifest from parameters.
   * Handles ID generation and signing automatically.
   */
  buildManifest(params: Omit<IntentManifest, 'proposalId' | 'agentSignature' | 'timestamp'> & {
    agentKeypair: Keypair;
  }): IntentManifest {
    const { agentKeypair, ...rest } = params;
    const partial: Omit<IntentManifest, 'agentSignature'> = {
      ...rest,
      proposalId: crypto.randomUUID(),
      timestamp:  Date.now(),
    };
    const signature = agentKeypair.sign(
      Buffer.from(JSON.stringify(partial), 'utf8')
    ).toString('hex');

    return { ...partial, agentSignature: signature };
  }
}
