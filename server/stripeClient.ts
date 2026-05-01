import Stripe from 'stripe';

export function getUncachableStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY environment variable is required. ' +
      'Set it in your Railway environment variables.'
    );
  }
  return new Stripe(secretKey);
}
