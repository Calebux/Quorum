import { BaseArbiter } from './base';
import { IntentManifest } from '../types/intent';
import { Keypair } from '@stellar/stellar-sdk';

const VERIFIED_PROTOCOLS: Record<string, string> = {
  'soroswap': 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  'phoenix':  'CBCZGGNOEUZG3IFSTYGDNBZXDSQPBR6AX6JDPPGKV4CZOSXZOLCF2ZTG',
  'blend':    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
};

export class ParameterArbiter extends BaseArbiter {
  readonly id: string;
  readonly speciality = 'parameter' as const;
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
    const flags: string[] = [];

    if (manifest.maxSlippage > 0.15) {
      flags.push(`Max slippage ${manifest.maxSlippage * 100}% exceeds 15% safety limit`);
    }

    const now            = Math.floor(Date.now() / 1000);
    const timeToDeadline = manifest.deadline - now;
    if (timeToDeadline < 0) {
      flags.push(`Transaction deadline has already passed`);
    } else if (timeToDeadline < 15) {
      flags.push(`Deadline only ${timeToDeadline}s away — insufficient time for safe execution`);
    }

    const amount = parseFloat(manifest.amount);
    if (isNaN(amount) || amount <= 0) {
      flags.push(`Invalid amount: ${manifest.amount}`);
    }

    const minReceived = parseFloat(manifest.minReceived);
    if (isNaN(minReceived) || minReceived <= 0) {
      flags.push(`Invalid minReceived: ${manifest.minReceived}`);
    }

    // Note: minReceived vs amount comparison is intentionally skipped for swaps —
    // cross-asset swaps (e.g. XLM→USDC) have inherently different output denominations.
    // The Intent Arbiter checks whether minReceived is consistent with the stated rate.

    const verifiedAddress = VERIFIED_PROTOCOLS[manifest.protocol.toLowerCase()];
    if (!verifiedAddress) {
      flags.push(`Protocol "${manifest.protocol}" is not in the verified whitelist`);
    } else if (verifiedAddress !== manifest.protocolAddress) {
      flags.push(`Protocol address mismatch — expected ${verifiedAddress}, got ${manifest.protocolAddress}`);
    }

    const approved = flags.length === 0;

    return {
      decision:   approved ? 'approve' : 'reject',
      confidence: approved ? 0.95 : Math.max(0, 0.1 * (10 - flags.length * 2)),
      reasoning:  approved
        ? 'All transaction parameters are within safe ranges'
        : `Found ${flags.length} parameter issue(s)`,
      flags,
    };
  }
}
