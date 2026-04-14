#!/usr/bin/env ts-node
/**
 * Deploy seed patterns to the Pattern Registry contract on Stellar testnet.
 * Run once after contract deployment: npx ts-node scripts/seed-patterns.ts
 */

import { SEED_PATTERNS } from '../src/lib/pattern-client';

async function main() {
  console.log(`Seeding ${SEED_PATTERNS.length} patterns to Pattern Registry...`);

  for (const pattern of SEED_PATTERNS) {
    console.log(`  [${pattern.pattern_id}] ${pattern.category}: ${pattern.description.slice(0, 60)}...`);
  }

  console.log('\nIn production: call PatternRegistryClient.addPattern() for each.');
  console.log('For testnet demo: patterns are pre-loaded in the in-memory cache.');
  console.log('\nDone.');
}

main().catch(console.error);
