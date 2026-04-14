import { SEED_PATTERNS } from '../../../lib/pattern-client';

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Critical'
};
const SEVERITY_COLOURS: Record<number, string> = {
  1: 'text-gray-400', 2: 'text-blue-400', 3: 'text-yellow-400', 4: 'text-orange-400', 5: 'text-red-400'
};

export default function PatternsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Adversarial Pattern Registry</h1>
        <p className="text-gray-400 text-sm mt-1">Known attack signatures. Every agent using Quorum is protected by all of these.</p>
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
            {SEED_PATTERNS.map((p) => (
              <tr key={p.pattern_id} className="hover:bg-gray-900 transition-colors">
                <td className="px-4 py-3 font-mono text-violet-400">{p.pattern_id}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-300">{p.category.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3 text-gray-300">{p.description}</td>
                <td className={`px-4 py-3 font-medium ${SEVERITY_COLOURS[p.severity]}`}>
                  {SEVERITY_LABELS[p.severity]} ({p.severity})
                </td>
                <td className="px-4 py-3 text-right text-gray-400">{p.catch_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
