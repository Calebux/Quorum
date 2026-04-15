export const dynamic = 'force-dynamic';

import { SEED_PATTERNS } from '../../../lib/pattern-client';
import { db } from '../../../lib/db';

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Critical'
};
const SEVERITY_COLOURS: Record<number, string> = {
  1: 'text-gray-400', 2: 'text-blue-400', 3: 'text-yellow-400', 4: 'text-orange-400', 5: 'text-red-400'
};

export default function PatternsPage() {
  const catches  = db.getPatternCatches();
  const patterns = SEED_PATTERNS.map(p => ({
    ...p,
    catch_count: catches[p.pattern_id] ?? 0,
  }));
  const totalCatches = patterns.reduce((sum, p) => sum + p.catch_count, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Adversarial Pattern Registry</h1>
          <p className="text-gray-400 text-sm mt-1">Known attack signatures. Every agent using Quorum is protected by all of these.</p>
        </div>
        {totalCatches > 0 && (
          <div className="text-sm text-orange-400 border border-orange-800 bg-orange-950 px-3 py-1.5 rounded-lg">
            {totalCatches} attack{totalCatches !== 1 ? 's' : ''} caught
          </div>
        )}
      </div>
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 border-b border-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">ID</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Description</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Severity</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Catches</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {patterns.map((p) => (
              <tr key={p.pattern_id} className={`hover:bg-gray-900 transition-colors ${p.catch_count > 0 ? 'border-l-2 border-l-orange-700' : ''}`}>
                <td className="px-4 py-3 font-mono text-violet-400">{p.pattern_id}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-300">{p.category.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3 text-gray-300">{p.description}</td>
                <td className={`px-4 py-3 font-medium ${SEVERITY_COLOURS[p.severity]}`}>
                  {SEVERITY_LABELS[p.severity]} ({p.severity})
                </td>
                <td className={`px-4 py-3 text-right font-medium ${p.catch_count > 0 ? 'text-orange-400' : 'text-gray-600'}`}>
                  {p.catch_count > 0 ? p.catch_count : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
