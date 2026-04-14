export default function ProposalPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <div className="mb-6">
        <a href="/" className="text-gray-500 text-sm hover:text-white transition-colors">← Back to feed</a>
        <h1 className="text-2xl font-bold text-white mt-2 font-mono">Proposal {params.id}</h1>
      </div>
      <div className="border border-gray-800 rounded-lg p-6 bg-gray-900 text-gray-400 text-sm">
        <p>Proposal detail view — connect to the SSE stream or SQLite to load full manifest and verdicts.</p>
        <p className="mt-2 font-mono text-gray-600">ID: {params.id}</p>
      </div>
    </div>
  );
}
