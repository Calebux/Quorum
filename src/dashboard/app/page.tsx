'use client';

import { useEffect, useRef, useState } from 'react';

interface StreamEvent {
  type: string;
  payload: Record<string, unknown>;
  id: string;
}

function RiskBadge({ tier }: { tier: string }) {
  const colours: Record<string, string> = {
    'fast':           'bg-green-900 text-green-300 border-green-700',
    'standard':       'bg-yellow-900 text-yellow-300 border-yellow-700',
    'high-scrutiny':  'bg-red-900 text-red-300 border-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${colours[tier] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {tier}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  return outcome === 'approved'
    ? <span className="text-xs px-2 py-0.5 rounded border bg-green-900 text-green-300 border-green-700 font-medium">approved</span>
    : <span className="text-xs px-2 py-0.5 rounded border bg-red-900 text-red-300 border-red-700 font-medium">rejected</span>;
}

export default function LiveFeed() {
  const [events, setEvents]   = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const evtSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const src = new EventSource('/api/stream');
    evtSourceRef.current = src;

    src.onopen = () => setConnected(true);
    src.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as StreamEvent;
        setEvents(prev => [event, ...prev].slice(0, 100));
      } catch { /* ignore */ }
    };
    src.onerror = () => setConnected(false);

    return () => { src.close(); };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Verification Feed</h1>
          <p className="text-gray-400 text-sm mt-1">Every proposal flowing through Quorum in real time</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className={connected ? 'text-green-400' : 'text-red-400'}>{connected ? 'connected' : 'disconnected'}</span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="border border-dashed border-gray-700 rounded-lg p-16 text-center">
          <div className="text-4xl mb-4">&#9744;</div>
          <p className="text-gray-400">Waiting for proposals...</p>
          <p className="text-gray-600 text-sm mt-1">Submit a proposal via POST /api/propose to see it here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="border border-gray-800 rounded-lg p-4 bg-gray-900 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-mono">{event.type}</span>
                <span className="text-xs text-gray-600">{new Date().toLocaleTimeString()}</span>
              </div>
              {event.type === 'proposal:received' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-white font-medium">{String(event.payload.action)}</span>
                  <span className="text-gray-300">{String(event.payload.amount)} {String(event.payload.fromAsset)} → {String(event.payload.toAsset)}</span>
                  <RiskBadge tier={String(event.payload.riskTier)} />
                  <a href={`/proposal/${String(event.payload.proposalId)}`} className="text-violet-400 text-xs hover:underline font-mono">
                    {String(event.payload.proposalId).slice(0, 8)}...
                  </a>
                </div>
              )}
              {event.type === 'arbiter:verdict' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-gray-400 text-sm">{String(event.payload.arbiterId)}</span>
                  <OutcomeBadge outcome={String(event.payload.decision)} />
                  <span className="text-gray-500 text-xs">{Math.round((event.payload.confidence as number) * 100)}% confidence</span>
                  {(event.payload.flags as string[])?.length > 0 && (
                    <span className="text-red-400 text-xs">{(event.payload.flags as string[]).join(', ')}</span>
                  )}
                </div>
              )}
              {event.type === 'consensus:reached' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-gray-400 text-sm">Consensus:</span>
                  <OutcomeBadge outcome={String(event.payload.outcome)} />
                  <span className="text-gray-500 text-xs">{String(event.payload.approvalCount)}/{String(event.payload.requiredCount)} approvals</span>
                </div>
              )}
              {event.type === 'funds:released' && (
                <div className="flex items-center gap-3">
                  <span className="text-green-400 text-sm">Funds released</span>
                  <span className="text-gray-500 text-xs font-mono">{String(event.payload.txHash)}</span>
                </div>
              )}
              {event.type === 'funds:returned' && (
                <div className="flex items-center gap-3">
                  <span className="text-red-400 text-sm">Funds returned</span>
                  <span className="text-gray-500 text-xs font-mono">{String(event.payload.incidentId)}</span>
                </div>
              )}
              {event.type === 'pattern:caught' && (
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 text-sm">Pattern caught:</span>
                  <span className="text-gray-400 text-xs">{String(event.payload.category)}</span>
                  <span className="text-gray-600 text-xs">severity {String(event.payload.severity)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
