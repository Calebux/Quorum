import {
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';

const RPC_URL         = process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const CONTRACT_ID     = process.env.ARBITER_REGISTRY_CONTRACT_ID ?? '';
const ORCHESTRATOR_SK = process.env.QUORUM_ORCHESTRATOR_SECRET ?? '';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

const server = new SorobanRpc.Server(RPC_URL);

async function invokeContract(
  method: string,
  args: Parameters<typeof nativeToScVal>[0][],
  signerKeypair: Keypair,
): Promise<unknown> {
  if (!CONTRACT_ID || !ORCHESTRATOR_SK) {
    console.warn(`[RegistryClient] Mock mode — skipping ${method}`);
    return null;
  }
  const account  = await server.getAccount(signerKeypair.publicKey());
  const contract = new Contract(CONTRACT_ID);
  const scArgs   = args.map(a => nativeToScVal(a));

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

export const ArbiterRegistryClient = {
  async register(arbiterId: string, address: string, speciality: string): Promise<void> {
    if (!ORCHESTRATOR_SK) return;
    const keypair = Keypair.fromSecret(ORCHESTRATOR_SK);
    await invokeContract('register', [arbiterId, address, speciality], keypair);
  },

  async updateReputation(arbiterId: string, delta: number): Promise<void> {
    if (!ORCHESTRATOR_SK) {
      console.warn(`[RegistryClient] Mock — reputation update for ${arbiterId}: ${delta > 0 ? '+' : ''}${delta}`);
      return;
    }
    const keypair = Keypair.fromSecret(ORCHESTRATOR_SK);
    await invokeContract('update_reputation', [arbiterId, keypair.publicKey(), delta], keypair);
  },

  async getReputation(arbiterId: string): Promise<number> {
    if (!CONTRACT_ID) return 50;
    const keypair = Keypair.fromSecret(ORCHESTRATOR_SK);
    const result  = await invokeContract('get_reputation', [arbiterId], keypair);
    return typeof result === 'number' ? result : 50;
  },
};
