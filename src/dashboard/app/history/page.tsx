export const dynamic = 'force-dynamic';

import { db } from '../../../lib/db';

function OutcomeBadge({ outcome }: { outcome: string }) {
  return outcome === 'approved'
    ? <span className="text-xs px-2 py-0.5 rounded border bg-green-900 text-green-300 border-green-700">approved</span>
    : <span className="text-xs px-2 py-0.5 rounded border bg-red-900 text-red-300 border-red-700">rejected</span>;
}

function RiskBadge({ tier }: { tier: string }) {
  const colours: Record<string, string> = {
    'fast':           'bg-green-900 text-green-300 border-green-700',
    'standard':       'bg-yellow-900 text-yellow-300 border-yellow-700',
    'high-scrutiny':  'bg-red-900 text-red-300 border-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colours[tier] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {tier}
    </span>
  );
}

export default function HistoryPage() {
  const proposals = db.getRecentProposals(50);
  const stats     = db.getStats();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Proposal History</h1>
          <p className="text-gray-400 text-sm mt-1">All verified proposals — persisted across restarts</p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">{stats.totalProposals} total</span>
          <span className="text-green-400">{stats.approved} approved</span>
          <span className="text-red-400">{stats.rejected} rejected</span>
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="border border-dashed border-gray-700 rounded-lg p-16 text-center">
          <p className="text-gray-400">No proposals yet.</p>
          <p className="text-gray-600 text-sm mt-1">Submit one from the <a href="/" className="text-violet-400 hover:underline">Live Feed</a> page.</p>
        </div>
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">ID</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Action</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Tier</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Outcome</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Time</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {proposals.map((p) => (
                <tr key={p.id} className="hover:bg-gray-900 transition-colors">
                  <td className="px-4 py-3 font-mono text-violet-400 text-xs">{p.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-white">{p.action}</td>
                  <td className="px-4 py-3 text-gray-300">{p.amount} {p.fromAsset} → {p.toAsset}</td>
                  <td className="px-4 py-3"><RiskBadge tier={p.riskTier} /></td>
                  <td className="px-4 py-3"><OutcomeBadge outcome={p.outcome} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.createdAt).toLocaleTimeString()}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/proposal/${p.id}`} className="text-violet-400 text-xs hover:underline">view →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
