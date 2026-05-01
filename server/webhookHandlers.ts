import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from './log';
import type Stripe from 'stripe';

const processedEventIds = new Set<string>();
const MAX_PROCESSED_IDS = 10_000;

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

    await WebhookHandlers.syncPlanFromStripe(payload, signature);
  }

  private static async syncPlanFromStripe(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      log('Stripe webhook plan sync skipped — STRIPE_WEBHOOK_SECRET not set', 'stripe');
      return;
    }

    const { getUncachableStripeClient } = await import('./stripeClient');
    const stripe = getUncachableStripeClient();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      log(`STRIPE WEBHOOK ERROR: Signature validation failed — ${err.message}`, 'stripe');
      throw err;
    }

    if (processedEventIds.has(event.id)) {
      log(`Stripe webhook: duplicate event ${event.id} ignored`, 'stripe');
      return;
    }
    if (processedEventIds.size >= MAX_PROCESSED_IDS) {
      const first = processedEventIds.values().next().value;
      if (first) processedEventIds.delete(first);
    }
    processedEventIds.add(event.id);

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
        const priceMeta = item.price?.metadata ?? {};
        let planMeta: string | undefined = priceMeta?.plan;

        if (!planMeta) {
          const productRef = item.price?.product;
          let productObj: Stripe.Product | null = null;
          if (typeof productRef === 'string') {
            try { productObj = await stripe.products.retrieve(productRef); } catch { /* ignore */ }
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
      stripeSubscriptionId,
      trialEndsAt,
    }).where(eq(users.id, user.id));

    log(`Stripe webhook: updated user ${user.id} plan → ${plan}`, 'stripe');
  }
}
