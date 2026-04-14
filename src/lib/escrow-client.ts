import {
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  Address,
} from '@stellar/stellar-sdk';
import { IntentManifest } from '../types/intent';

const RPC_URL         = process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const CONTRACT_ID     = process.env.ESCROW_CONTRACT_ID ?? '';
const ORCHESTRATOR_SK = process.env.QUORUM_ORCHESTRATOR_SECRET ?? '';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

const server = new SorobanRpc.Server(RPC_URL);

async function invokeContract(
  contractId: string,
  method: string,
  args: Parameters<typeof nativeToScVal>[0][],
  signerKeypair: Keypair,
): Promise<unknown> {
  const account    = await server.getAccount(signerKeypair.publicKey());
  const contract   = new Contract(contractId);
  const scArgs     = args.map(a => nativeToScVal(a));

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  preparedTx.sign(signerKeypair);

  const result = await server.sendTransaction(preparedTx);
  if (result.status === 'ERROR') throw new Error(`Contract call failed: ${JSON.stringify(result)}`);

  // Poll for confirmation
  let getResult = await server.getTransaction(result.hash);
  while (getResult.status === 'NOT_FOUND') {
    await new Promise(r => setTimeout(r, 1000));
    getResult = await server.getTransaction(result.hash);
  }

  if (getResult.status === 'SUCCESS') {
    return getResult.returnValue ? scValToNative(getResult.returnValue) : null;
  }
  throw new Error(`Transaction failed: ${getResult.status}`);
}

export const EscrowClient = {
  async lockFunds(manifest: IntentManifest): Promise<void> {
    if (!CONTRACT_ID || !ORCHESTRATOR_SK) {
      console.warn('[EscrowClient] Mock mode — skipping on-chain lock');
      return;
    }
    const keypair = Keypair.fromSecret(ORCHESTRATOR_SK);
    await invokeContract(
      CONTRACT_ID,
      'lock_funds',
      [manifest.proposalId, manifest.agentId, manifest.fromAsset, manifest.amount],
      keypair,
    );
  },

  async releaseFunds(proposalId: string, recipientAddress: string): Promise<string> {
    if (!CONTRACT_ID || !ORCHESTRATOR_SK) {
      const mockHash = `mock-tx-${Date.now()}`;
      console.warn(`[EscrowClient] Mock mode — release: ${mockHash}`);
      return mockHash;
    }
    const keypair = Keypair.fromSecret(ORCHESTRATOR_SK);
    const txHash  = `tx-${Date.now()}`;
    await invokeContract(
      CONTRACT_ID,
      'release_funds',
      [proposalId, keypair.publicKey(), recipientAddress, txHash],
      keypair,
    );
    return txHash;
  },

  async returnFunds(proposalId: string): Promise<void> {
    if (!CONTRACT_ID || !ORCHESTRATOR_SK) {
      console.warn('[EscrowClient] Mock mode — skipping return');
      return;
    }
    const keypair = Keypair.fromSecret(ORCHESTRATOR_SK);
    await invokeContract(
      CONTRACT_ID,
      'return_funds',
      [proposalId, keypair.publicKey()],
      keypair,
    );
  },
};
