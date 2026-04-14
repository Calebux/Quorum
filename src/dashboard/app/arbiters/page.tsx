export default function ArbitersPage() {
  const arbiters = [
    {
      id: 'arbiter-intent',
      speciality: 'Intent Verification',
      description: 'Checks whether transaction parameters faithfully represent the human\'s original instruction',
      reputation: 50,
      verdicts: 0,
    },
    {
      id: 'arbiter-parameter',
      speciality: 'Parameter Validation',
      description: 'Validates amounts, slippage tolerances, deadlines, and protocol addresses',
      reputation: 50,
      verdicts: 0,
    },
    {
      id: 'arbiter-adversarial',
      speciality: 'Adversarial Detection',
      description: 'Scans for prompt injection, manipulation patterns, and novel attack vectors',
      reputation: 50,
      verdicts: 0,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Arbiter Panel</h1>
        <p className="text-gray-400 text-sm mt-1">Three independent verification agents, each with an on-chain Stellar identity</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {arbiters.map((arbiter) => (
          <div key={arbiter.id} className="border border-gray-800 rounded-lg p-5 bg-gray-900">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-violet-900 flex items-center justify-center text-violet-300 font-bold text-sm">
                {arbiter.speciality[0]}
              </div>
              <div>
                <div className="text-white font-medium text-sm">{arbiter.speciality}</div>
                <div className="text-gray-500 text-xs font-mono">{arbiter.id}</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">{arbiter.description}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Reputation</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-800 rounded-full h-1.5">
                  <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${arbiter.reputation}%` }} />
                </div>
                <span className="text-violet-400 font-medium">{arbiter.reputation}/100</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-gray-500">Verdicts cast</span>
              <span className="text-gray-400">{arbiter.verdicts}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
