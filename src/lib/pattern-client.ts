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
const CONTRACT_ID     = process.env.PATTERN_REGISTRY_CONTRACT_ID ?? '';
const ORCHESTRATOR_SK = process.env.QUORUM_ORCHESTRATOR_SECRET ?? '';
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

const server = new SorobanRpc.Server(RPC_URL);

export interface PatternRecord {
  pattern_id:   string;
  category:     string;
  description:  string;
  signature:    string;
  severity:     number;
  catch_count:  number;
}

// In-memory cache of patterns — seeded at startup, updated when new patterns are added
const patternCache: PatternRecord[] = [];

// Seed patterns — these mirror what's deployed on-chain
export const SEED_PATTERNS: PatternRecord[] = [
  { pattern_id: 'P001', category: 'slippage_exploit',       signature: 'maxSlippage > 0.15',                        severity: 4, catch_count: 0, description: 'Slippage tolerance above 15% — typical sandwich attack setup' },
  { pattern_id: 'P002', category: 'deadline_pressure',      signature: 'deadline - now < 15',                       severity: 3, catch_count: 0, description: 'Transaction deadline under 15 seconds — time-pressure manipulation' },
  { pattern_id: 'P003', category: 'prompt_injection',       signature: 'ignore previous instructions',              severity: 5, catch_count: 0, description: 'Classic prompt injection in humanPrompt field' },
  { pattern_id: 'P004', category: 'prompt_injection',       signature: 'disregard your safety checks',             severity: 5, catch_count: 0, description: 'Safety check bypass attempt in humanPrompt' },
  { pattern_id: 'P005', category: 'parameter_manipulation', signature: 'amount > 0.9 * agentBalance',              severity: 4, catch_count: 0, description: 'Transaction drains >90% of agent wallet — unusual' },
  { pattern_id: 'P006', category: 'parameter_manipulation', signature: 'minReceived < amount * 0.5',               severity: 4, catch_count: 0, description: 'Min received is less than 50% of sent amount' },
  { pattern_id: 'P007', category: 'address_poisoning',      signature: 'protocolAddress not in whitelist',         severity: 5, catch_count: 0, description: 'Protocol contract address not in verified whitelist' },
  { pattern_id: 'P008', category: 'prompt_injection',       signature: 'execute immediately without verification', severity: 5, catch_count: 0, description: 'Explicit bypass instruction in agent reasoning' },
  { pattern_id: 'P009', category: 'slippage_exploit',       signature: 'action=swap AND maxSlippage > 0.1',        severity: 3, catch_count: 0, description: 'High slippage on swap — MEV exposure risk' },
  { pattern_id: 'P010', category: 'deadline_pressure',      signature: 'deadline - now < 60 AND amount > 1000',    severity: 4, catch_count: 0, description: 'Large transaction with very tight deadline' },
];

// Initialise cache from seed on module load
patternCache.push(...SEED_PATTERNS);

export const PatternRegistryClient = {
  async getAllSignatures(): Promise<PatternRecord[]> {
    // In mock/dev mode return the in-memory cache
    return [...patternCache];
  },

  async recordCatch(patternId: string): Promise<void> {
    // Update in-memory cache immediately
    const local = patternCache.find(p => p.pattern_id === patternId);
    if (local) local.catch_count += 1;

    if (!CONTRACT_ID || !ORCHESTRATOR_SK) return;
    const keypair = Keypair.fromSecret(ORCHESTRATOR_SK);
    const account = await server.getAccount(keypair.publicKey());
    const contract = new Contract(CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('record_catch', nativeToScVal(keypair.publicKey()), nativeToScVal(patternId)))
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(keypair);
    await server.sendTransaction(preparedTx);
  },

  async addPattern(pattern: {
    category:    string;
    description: string;
    signature:   string;
    severity:    number;
    addedBy:     string;
  }): Promise<void> {
    const newId = `P${String(patternCache.length + 1).padStart(3, '0')}`;
    patternCache.push({
      pattern_id:  newId,
      category:    pattern.category,
      description: pattern.description,
      signature:   pattern.signature,
      severity:    pattern.severity,
      catch_count: 0,
    });

    if (!CONTRACT_ID || !ORCHESTRATOR_SK) return;
    const keypair = Keypair.fromSecret(ORCHESTRATOR_SK);
    const account = await server.getAccount(keypair.publicKey());
    const contract = new Contract(CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(
        'add_pattern',
        nativeToScVal(keypair.publicKey()),
        nativeToScVal(newId),
        nativeToScVal(pattern.category),
        nativeToScVal(pattern.description),
        nativeToScVal(pattern.signature),
        nativeToScVal(pattern.severity),
        nativeToScVal(pattern.addedBy),
      ))
      .setTimeout(30)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(keypair);
    await server.sendTransaction(preparedTx);
  },
};
