/**
 * Idempotent Stripe product/price seeder for AXIS subscription plans.
 *
 * Usage: npx tsx scripts/seed-stripe-products.ts
 *
 * This script creates (or finds existing) Stripe Products and Prices for:
 *   - Starter: free (product only, no recurring price)
 *   - Personal AI: R$9/month with 7-day free trial
 *   - Team: R$29/month
 *
 * Products and prices are tagged with `plan` metadata so the webhook handler
 * can reliably map subscriptions to AXIS plan keys.
 *
 * Safe to run multiple times — it will skip creation if a matching product/price exists.
 */

import { getUncachableStripeClient } from '../server/stripeClient';

const PLANS = [
  {
    planKey: 'starter',
    name: 'AXIS Starter',
    description: 'Free tier with basic limits — 200 transactions, 30 AI captures, and 10 chat messages per month.',
    unitAmount: null, // Free plan — product only, no recurring price
    currency: null,
    trialPeriodDays: undefined,
  },
  {
    planKey: 'personal_ai',
    name: 'AXIS Personal AI',
    description: 'Full AI-powered personal finance and life OS — unlimited captures, voice, chat.',
    unitAmount: 900, // R$9.00 in centavos
    currency: 'brl',
    trialPeriodDays: 7,
  },
  {
    planKey: 'team',
    name: 'AXIS Team',
    description: 'Everything in Personal AI plus full Business version for teams and companies.',
    unitAmount: 2900, // R$29.00 in centavos
    currency: 'brl',
    trialPeriodDays: undefined,
  },
];

async function seed() {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    console.log(`\n── ${plan.name} (${plan.planKey}) ──`);

    // Check if a product with this plan key already exists
    const existingProducts = await stripe.products.search({
      query: `metadata['plan']:'${plan.planKey}'`,
    });

    let product: any;
    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`  ✓ Product already exists: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { plan: plan.planKey },
      });
      console.log(`  + Created product: ${product.id}`);
    }

    if (!plan.unitAmount || !plan.currency) {
      console.log(`  ✓ Free plan — no recurring price needed.`);
      continue;
    }

    // Check if a matching active price already exists for this product
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      type: 'recurring',
    });

    const matchingPrice = existingPrices.data.find(
      p =>
        p.unit_amount === plan.unitAmount &&
        p.currency === plan.currency &&
        p.recurring?.interval === 'month'
    );

    if (matchingPrice) {
      console.log(`  ✓ Price already exists: ${matchingPrice.id} (${plan.unitAmount / 100} ${plan.currency.toUpperCase()}/month)`);
    } else {
      const newPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.unitAmount,
        currency: plan.currency,
        recurring: {
          interval: 'month',
          ...(plan.trialPeriodDays ? { trial_period_days: plan.trialPeriodDays } : {}),
        },
        metadata: { plan: plan.planKey },
      });
      console.log(`  + Created price: ${newPrice.id} (${plan.unitAmount / 100} ${plan.currency.toUpperCase()}/month${plan.trialPeriodDays ? ` · ${plan.trialPeriodDays}-day trial` : ''})`);
    }
  }

  console.log('\n✓ Stripe products seeded successfully.\n');
}

seed().catch(err => {
  console.error('Stripe seed error:', err.message);
  process.exit(1);
});
