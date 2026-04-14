import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@stellar/stellar-sdk', 'better-sqlite3'],
  },
};

export default nextConfig;
