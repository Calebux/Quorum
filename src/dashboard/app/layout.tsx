import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quorum — Agent Verification Layer',
  description: 'Independent multi-agent verification for autonomous AI transactions on Stellar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-mono">
        <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-xs font-bold">Q</div>
            <span className="font-semibold text-white tracking-tight">QUORUM</span>
            <span className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded">Stellar Testnet</span>
          </div>
          <nav className="flex gap-6 text-sm text-gray-400">
            <a href="/"          className="hover:text-white transition-colors">Live Feed</a>
            <a href="/patterns"  className="hover:text-white transition-colors">Patterns</a>
            <a href="/arbiters"  className="hover:text-white transition-colors">Arbiters</a>
            <a href="/history"  className="hover:text-white transition-colors">History</a>
          </nav>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
