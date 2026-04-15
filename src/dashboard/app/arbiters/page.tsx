'use client';

import { useEffect, useState } from 'react';

interface ArbiterState {
  id:         string;
  speciality: string;
  description: string;
  reputation:  number;
  verdicts:    number;
  approvals:   number;
  rejections:  number;
  lastVerdict?: 'approve' | 'reject';
}

const INITIAL_ARBITERS: ArbiterState[] = [
  {
    id:          'arbiter-intent',
    speciality:  'Intent Verification',
    description: "Checks whether transaction parameters faithfully represent the human's original instruction. Uses Claude to bridge natural language intent and on-chain execution.",
    reputation:  50,
    verdicts:    0,
    approvals:   0,
    rejections:  0,
  },
  {
    id:          'arbiter-param',
    speciality:  'Parameter Validation',
    description: 'Validates amounts, slippage tolerances, deadlines, and protocol addresses against known safe ranges. Fully deterministic — no LLM required.',
    reputation:  50,
    verdicts:    0,
    approvals:   0,
    rejections:  0,
  },
  {
    id:          'arbiter-adv',
    speciality:  'Adversarial Detection',
    description: 'Scans proposals against 10 known attack signatures, then uses Claude to detect novel attack vectors. Writes new patterns back to the on-chain registry.',
    reputation:  50,
    verdicts:    0,
    approvals:   0,
    rejections:  0,
  },
];

export default function ArbitersPage() {
  const [arbiters, setArbiters] = useState<ArbiterState[]>(INITIAL_ARBITERS);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const src = new EventSource('/api/stream');
    src.onopen    = () => setConnected(true);
    src.onerror   = () => setConnected(false);
    src.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as {
          type: string;
          payload: Record<string, unknown>;
        };

        if (event.type === 'arbiter:verdict') {
          const { arbiterId, decision } = event.payload as { arbiterId: string; decision: 'approve' | 'reject' };
          setArbiters(prev => prev.map(a => {
            // Match by prefix (the actual ID includes a pubkey suffix)
            if (!arbiterId.startsWith(a.id)) return a;
            const delta = decision === 'approve' ? 3 : 0;
            return {
              ...a,
              verdicts:    a.verdicts + 1,
              approvals:   a.approvals + (decision === 'approve' ? 1 : 0),
              rejections:  a.rejections + (decision === 'reject' ? 1 : 0),
              reputation:  Math.min(100, Math.max(0, a.reputation + delta)),
              lastVerdict: decision,
            };
          }));
        }

        if (event.type === 'reputation:updated') {
          const { arbiterId, newScore } = event.payload as { arbiterId: string; newScore: number };
          setArbiters(prev => prev.map(a =>
            arbiterId.startsWith(a.id) ? { ...a, reputation: newScore } : a
          ));
        }
      } catch { /* ignore */ }
    };
    return () => src.close();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Arbiter Panel</h1>
          <p className="text-gray-400 text-sm mt-1">Three independent verification agents, each with an on-chain Stellar identity</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className={connected ? 'text-green-400' : 'text-gray-500'}>{connected ? 'live' : 'static'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {arbiters.map((arbiter) => (
          <div key={arbiter.id}
            className={`border rounded-lg p-5 bg-gray-900 transition-all duration-300 ${
              arbiter.lastVerdict === 'approve' ? 'border-green-700' :
              arbiter.lastVerdict === 'reject'  ? 'border-red-700'  : 'border-gray-800'
            }`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                arbiter.lastVerdict === 'approve' ? 'bg-green-900 text-green-300' :
                arbiter.lastVerdict === 'reject'  ? 'bg-red-900 text-red-300'    : 'bg-violet-900 text-violet-300'
              }`}>
                {arbiter.speciality[0]}
              </div>
              <div>
                <div className="text-white font-medium text-sm">{arbiter.speciality}</div>
                <div className="text-gray-500 text-xs font-mono">{arbiter.id}</div>
              </div>
            </div>

            <p className="text-gray-400 text-xs mb-4 leading-relaxed">{arbiter.description}</p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Reputation</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        arbiter.reputation >= 70 ? 'bg-green-500' :
                        arbiter.reputation >= 40 ? 'bg-violet-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${arbiter.reputation}%` }}
                    />
                  </div>
                  <span className="text-violet-400 font-medium w-12 text-right">{arbiter.reputation}/100</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Verdicts</span>
                <span className="text-gray-300">{arbiter.verdicts}</span>
              </div>

              {arbiter.verdicts > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Approve / Reject</span>
                  <span>
                    <span className="text-green-400">{arbiter.approvals}</span>
                    <span className="text-gray-600"> / </span>
                    <span className="text-red-400">{arbiter.rejections}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border border-gray-800 rounded-lg p-5 bg-gray-900">
        <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">How Consensus Works</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { tier: 'fast', colour: 'text-green-400', arbiters: 'Parameter only', threshold: '< 1,000 XLM', required: '1/1' },
            { tier: 'standard', colour: 'text-yellow-400', arbiters: 'Intent + Parameter', threshold: '1k–10k XLM', required: '2/2' },
            { tier: 'high-scrutiny', colour: 'text-red-400', arbiters: 'All three', threshold: '> 10,000 XLM', required: '2/3' },
          ].map(t => (
            <div key={t.tier} className="border border-gray-700 rounded p-3">
              <div className={`text-xs font-medium mb-2 ${t.colour}`}>{t.tier}</div>
              <div className="text-gray-400 text-xs space-y-1">
                <div>{t.threshold}</div>
                <div>{t.arbiters}</div>
                <div className="text-white font-medium">{t.required} required</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
