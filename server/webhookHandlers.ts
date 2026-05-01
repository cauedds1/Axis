import { StripeSync } from 'stripe-replit-sync';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from './log';
import type Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      const msg =
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        `Received type: ${typeof payload}. ` +
        'FIX: Register webhook route BEFORE app.use(express.json()).';
      log(msg, 'stripe');
      throw new Error(msg);
    }

    if (!signature) {
      const msg = 'STRIPE WEBHOOK ERROR: Missing stripe-signature header.';
      log(msg, 'stripe');
      throw new Error(msg);
    }

    // Step 1: let StripeSync validate + sync the event into its DB tables
    const { getStripeSync } = await import('./stripeClient');
    const sync = await getStripeSync();
    try {
      await sync.processWebhook(payload, signature);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('No signatures found matching')) {
        log('STRIPE WEBHOOK ERROR: Signature validation failed. Possible replay or wrong secret.', 'stripe');
      }
      throw err;
    }

    // Step 2: parse the event ourselves to sync plan fields in our users table
    await WebhookHandlers.syncPlanFromStripe(payload, signature);
  }

  private static async syncPlanFromStripe(payload: Buffer, signature: string): Promise<void> {
    const { getUncachableStripeClient, getStripeCredentials } = await import('./stripeClient');

    let webhookSecret: string;
    try {
      const creds = await getStripeCredentials();
      if (!creds.webhookSecret) {
        log('Stripe webhook plan sync skipped — no webhookSecret available', 'stripe');
        return;
      }
      webhookSecret = creds.webhookSecret;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log(`Stripe webhook plan sync skipped — cannot get credentials: ${message}`, 'stripe');
      return;
    }

    const stripe = await getUncachableStripeClient();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      // Signature already validated by StripeSync above — this shouldn't happen
      return;
    }

    const relevantEvents: Stripe.Event.Type[] = [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ];

    if (!relevantEvents.includes(event.type)) return;

    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    if (!user) {
      log(`Stripe webhook: no user found for customer ${customerId}`, 'stripe');
      return;
    }

    let plan = 'starter';
    let stripeSubscriptionId: string | null = null;
    let trialEndsAt: Date | null = null;

    if (event.type !== 'customer.subscription.deleted' && subscription.status !== 'canceled') {
      stripeSubscriptionId = subscription.id;

      const items = subscription.items?.data ?? [];
      for (const item of items) {
        // Try price metadata first
        const priceMeta = item.price?.metadata ?? {};
        let planMeta: string | undefined = priceMeta?.plan;

        if (!planMeta) {
          // Product may be an ID string in the event — expand it
          const productRef = item.price?.product;
          let productObj: Stripe.Product | null = null;
          if (typeof productRef === 'string') {
            try {
              productObj = await stripe.products.retrieve(productRef);
            } catch { /* ignore */ }
          } else if (productRef && typeof productRef === 'object' && 'id' in productRef) {
            productObj = productRef as Stripe.Product;
          }
          planMeta = productObj?.metadata?.plan;
        }

        if (planMeta === 'personal_ai') { plan = 'personal_ai'; break; }
        if (planMeta === 'team') { plan = 'team'; break; }
      }

      if (subscription.trial_end) {
        trialEndsAt = new Date(subscription.trial_end * 1000);
      }
    }

    await db.update(users).set({
      plan,
      // Explicitly null-clear on cancellation so stale subscription data is removed
      stripeSubscriptionId: stripeSubscriptionId,
      trialEndsAt: trialEndsAt,
    }).where(eq(users.id, user.id));

    log(`Stripe webhook: updated user ${user.id} plan → ${plan}`, 'stripe');
  }
}
