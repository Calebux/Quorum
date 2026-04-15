/**
 * x402 payment helper for agents integrating with Quorum.
 * Handles the 402 → pay → retry flow automatically.
 *
 * Usage:
 *   import { fetchWithPayment } from '@quorum/sdk/x402-client';
 *   const res = await fetchWithPayment(url, { method: 'POST', body: ... }, {
 *     payerKeypair: Keypair.fromSecret('S...'),
 *     network: 'testnet',
 *   });
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Asset,
  Operation,
  Memo,
  type Account,
} from '@stellar/stellar-sdk';

export interface X402Config {
  payerKeypair: Keypair;
  network:      'testnet' | 'mainnet';
}

interface X402Requirement {
  payTo:             string;
  maxAmountRequired: string;
  asset:             { address: string };
  network:           string;
}

interface PaymentResponse {
  x402?: X402Requirement;
}

/**
 * Wraps a fetch call with automatic x402 payment handling.
 * If the server returns 402, pays the required amount and retries once.
 *
 * The payment is a Stellar transaction paying USDC (or XLM in demo mode)
 * to the address specified in the 402 response body.
 *
 * The X-PAYMENT header is a base64-encoded JSON string:
 *   { txHash, network, amount, payTo, txXdr }
 */
export async function fetchWithPayment(
  url:         string,
  options:     RequestInit,
  x402Config:  X402Config,
): Promise<Response> {
  // First attempt — no payment header
  const first = await fetch(url, options);

  if (first.status !== 402) return first;

  // Parse payment requirement from 402 response body
  let body: PaymentResponse;
  try {
    body = await first.json() as PaymentResponse;
  } catch {
    // Response not parseable — return original 402
    return first;
  }

  const req = body.x402;
  if (!req?.payTo || !req?.maxAmountRequired) return first;

  // Build and sign a Stellar payment transaction
  const horizonUrl = x402Config.network === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';

  const networkPassphrase = x402Config.network === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

  // Load the payer account from Horizon
  const accountRes = await fetch(
    `${horizonUrl}/accounts/${x402Config.payerKeypair.publicKey()}`,
  );
  if (!accountRes.ok) {
    throw new Error(
      `Failed to load Stellar account ${x402Config.payerKeypair.publicKey()}: ${accountRes.status}`,
    );
  }
  const accountData = await accountRes.json() as { id: string; sequence: string };

  // Construct a minimal Account object for TransactionBuilder
  const account: Account = {
    accountId:     () => accountData.id,
    sequenceNumber: () => accountData.sequence,
    incrementSequenceNumber: () => { /* not needed for single tx */ },
  };

  // Note: for demo purposes we use XLM native payment.
  // Production: use the USDC asset with the address from req.asset.address.
  const tx = new TransactionBuilder(account, {
    fee:               '100',
    networkPassphrase,
  })
    .addOperation(Operation.payment({
      destination: req.payTo,
      asset:       Asset.native(),           // swap for USDC asset in production
      amount:      req.maxAmountRequired,
    }))
    .addMemo(Memo.text('quorum-verify'))
    .setTimeout(30)
    .build();

  tx.sign(x402Config.payerKeypair);

  const paymentProof = {
    txHash:  tx.hash().toString('hex'),
    network: `stellar-${x402Config.network}`,
    amount:  req.maxAmountRequired,
    payTo:   req.payTo,
    txXdr:   tx.toXDR(),
  };

  const paymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

  // Retry with payment proof in X-PAYMENT header
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> ?? {}),
      'X-PAYMENT': paymentHeader,
    },
  });
}

/**
 * Encodes an already-completed Stellar transaction as an X-PAYMENT header value.
 * Use this if you build and submit the transaction yourself and only need
 * to produce the proof header for the retry request.
 */
export function encodePaymentHeader(proof: {
  txHash:  string;
  network: string;
  amount:  string;
  payTo:   string;
  txXdr?:  string;
}): string {
  return Buffer.from(JSON.stringify(proof)).toString('base64');
}
