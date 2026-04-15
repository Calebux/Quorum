import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@stellar/stellar-sdk', 'better-sqlite3'],
};

export default nextConfig;
