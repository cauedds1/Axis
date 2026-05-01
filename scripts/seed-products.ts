/**
 * Stripe product seeder — entry point alias for seed-stripe-products.ts
 * Usage: npx tsx scripts/seed-products.ts
 */
import { execSync } from 'child_process';
execSync('npx tsx ' + __dirname + '/seed-stripe-products.ts', { stdio: 'inherit' });
