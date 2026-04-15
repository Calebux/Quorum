export const dynamic = 'force-dynamic';

import { db } from '../../../../lib/db';

export default function ProposalPage({ params }: { params: { id: string } }) {
  const result = db.getProposalWithVerdicts(params.id);

  if (!result) {
    return (
      <div>
        <a href="/" className="text-gray-500 text-sm hover:text-white transition-colors">← Back to feed</a>
        <p className="text-gray-400 mt-4">Proposal not found.</p>
      </div>
    );
  }

  const { proposal, verdicts } = result;

  return (
    <div>
      <a href="/" className="text-gray-500 text-sm hover:text-white transition-colors">← Back to feed</a>
      <div className="flex items-center gap-3 mt-2 mb-6">
        <h1 className="text-2xl font-bold text-white font-mono">{proposal.id.slice(0, 16)}...</h1>
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
          proposal.outcome === 'approved'
            ? 'bg-green-900 text-green-300 border-green-700'
            : 'bg-red-900 text-red-300 border-red-700'
        }`}>{proposal.outcome}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-800 rounded-lg p-4 bg-gray-900">
          <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Transaction</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Action</span><span className="text-white">{proposal.action}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Amount</span><span className="text-white">{proposal.amount} {proposal.fromAsset} → {proposal.toAsset}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Protocol</span><span className="text-white">{proposal.protocol}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Risk Tier</span><span className="text-white">{proposal.riskTier}</span></div>
          </div>
        </div>
        <div className="border border-gray-800 rounded-lg p-4 bg-gray-900">
          <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Consensus</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Approvals</span><span className="text-white">{proposal.approvalCount}/{proposal.requiredCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Outcome</span><span className={proposal.outcome === 'approved' ? 'text-green-400' : 'text-red-400'}>{proposal.outcome}</span></div>
            {proposal.execTxHash && (
              <div className="flex justify-between"><span className="text-gray-400">Tx Hash</span>
                <a href={`https://stellar.expert/explorer/testnet/tx/${proposal.execTxHash}`} target="_blank" rel="noopener noreferrer" className="text-violet-400 font-mono text-xs hover:underline">{proposal.execTxHash.slice(0, 16)}...</a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-gray-800 rounded-lg p-4 bg-gray-900 mb-4">
        <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Human Prompt</div>
        <p className="text-gray-200 text-sm">&quot;{proposal.humanPrompt}&quot;</p>
      </div>

      <div className="border border-gray-800 rounded-lg p-4 bg-gray-900 mb-6">
        <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Arbiter Verdicts</div>
        <div className="space-y-3">
          {verdicts.map((v, i) => (
            <div key={i} className="border border-gray-700 rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">{v.arbiterId}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${v.decision === 'approve' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{v.decision}</span>
                <span className="text-xs text-gray-500">{Math.round(v.confidence * 100)}%</span>
              </div>
              <p className="text-gray-300 text-sm">{v.reasoning}</p>
              {v.flags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {v.flags.map((f, fi) => <span key={fi} className="text-xs bg-red-950 text-red-300 px-1.5 py-0.5 rounded">{f}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
