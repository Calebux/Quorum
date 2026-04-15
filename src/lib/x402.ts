// x402 payment verification middleware for Quorum
// Each call to /api/propose requires 0.01 USDC payment on Stellar testnet
//
// x402 is an HTTP-native payment protocol:
//   1. Client calls endpoint → server returns 402 with payment instructions
//   2. Client pays on-chain and encodes proof in X-PAYMENT header
//   3. Client retries request with X-PAYMENT header → server verifies and responds

export const VERIFICATION_FEE_USDC = '0.01';
export const PAYMENT_RECEIVER      = process.env.QUORUM_PAYMENT_RECEIVER ?? '';
export const STELLAR_NETWORK       = process.env.STELLAR_NETWORK ?? 'testnet';

export interface PaymentRequirement {
  scheme:            'exact';
  network:           string;
  asset:             { address: string; decimals: number };
  payTo:             string;
  maxAmountRequired: string;
  resource:          string;
  description:       string;
}

/**
 * Returns the 402 payment required response body.
 * This is what the client sees when they haven't paid yet.
 */
export function buildPaymentRequired(requestUrl: string): PaymentRequirement {
  return {
    scheme:  'exact',
    network: `stellar-${STELLAR_NETWORK}`,
    asset: {
      // USDC on Stellar testnet (Circle's contract)
      address:  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      decimals: 7,
    },
    payTo:             PAYMENT_RECEIVER || 'QUORUM_RECEIVER_NOT_CONFIGURED',
    maxAmountRequired: VERIFICATION_FEE_USDC,
    resource:          requestUrl,
    description:       'Quorum verification fee — 0.01 USDC per proposal',
  };
}

interface PaymentProof {
  txHash:  string;
  network: string;
  amount:  string;
  payTo:   string;
}

/**
 * Checks the X-PAYMENT header on the request.
 * Returns { valid: true } if payment is acceptable.
 *
 * Dev mode: if QUORUM_PAYMENT_RECEIVER is not set, payment check is skipped.
 *
 * Production: also verify the Stellar transaction exists on-chain and
 * hasn't been replayed (compare txHash against stored hashes in DB).
 */
export async function verifyPayment(
  paymentHeader: string | null,
  _requirement:  PaymentRequirement,
): Promise<{ valid: boolean; reason?: string }> {
  // Dev mode: receiver not configured → skip payment check entirely
  if (!PAYMENT_RECEIVER) {
    return { valid: true };
  }

  if (!paymentHeader) {
    return { valid: false, reason: 'Missing X-PAYMENT header' };
  }

  let decoded: PaymentProof;
  try {
    // Payment header: base64-encoded JSON with { txHash, network, amount, payTo }
    decoded = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf8'),
    ) as PaymentProof;
  } catch {
    return { valid: false, reason: 'Invalid payment header format — expected base64-encoded JSON' };
  }

  if (!decoded.txHash || !decoded.network || !decoded.amount || !decoded.payTo) {
    return { valid: false, reason: 'Payment proof missing required fields (txHash, network, amount, payTo)' };
  }

  if (decoded.payTo !== PAYMENT_RECEIVER) {
    return {
      valid:  false,
      reason: `Payment sent to wrong address: got ${decoded.payTo}, expected ${PAYMENT_RECEIVER}`,
    };
  }

  if (parseFloat(decoded.amount) < parseFloat(VERIFICATION_FEE_USDC)) {
    return {
      valid:  false,
      reason: `Insufficient payment: ${decoded.amount} USDC < required ${VERIFICATION_FEE_USDC} USDC`,
    };
  }

  const expectedNetwork = `stellar-${STELLAR_NETWORK}`;
  if (decoded.network !== expectedNetwork) {
    return {
      valid:  false,
      reason: `Wrong network: got ${decoded.network}, expected ${expectedNetwork}`,
    };
  }

  // TODO (production): verify txHash exists on Stellar Horizon and hasn't been replayed.
  // Example check using Horizon REST API:
  //   GET https://horizon-testnet.stellar.org/transactions/{txHash}
  // Then store txHash in DB to prevent replay attacks.

  return { valid: true };
}
