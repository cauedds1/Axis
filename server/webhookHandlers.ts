import { getStripeSync } from './stripeClient';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { log } from './log';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      const msg = 'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This means express.json() ran before this route. ' +
        'FIX: Register webhook route BEFORE app.use(express.json()).';
      log(msg, 'stripe');
      throw new Error(msg);
    }

    if (!signature) {
      const msg = 'STRIPE WEBHOOK ERROR: Missing stripe-signature header.';
      log(msg, 'stripe');
      throw new Error(msg);
    }

    const sync = await getStripeSync();

    try {
      await sync.processWebhook(payload, signature);
    } catch (err: any) {
      if (err?.message?.includes('No signatures found matching')) {
        log('STRIPE WEBHOOK ERROR: Signature validation failed. Possible replay or wrong secret.', 'stripe');
      }
      throw err;
    }

    await WebhookHandlers.syncPlanFromStripe(payload, signature);
  }

  private static async syncPlanFromStripe(payload: Buffer, signature: string): Promise<void> {
    try {
      const sync = await getStripeSync();
      const stripe = (sync as any).stripe;
      if (!stripe) return;

      const webhookSecret = (sync as any).stripeWebhookSecret;
      if (!webhookSecret) return;

      let event: any;
      try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } catch {
        return;
      }

      const relevantEvents = [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ];

      if (!relevantEvents.includes(event.type)) return;

      const subscription = event.data.object;
      const customerId = subscription.customer as string;

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
          // Try price metadata first, then expand product if needed
          const priceMeta = item.price?.metadata ?? {};
          let planMeta: string | undefined = priceMeta?.plan;

          if (!planMeta) {
            // product may be an ID string — expand it
            let productObj = item.price?.product;
            if (typeof productObj === 'string') {
              try {
                const { getUncachableStripeClient } = await import('./stripeClient');
                const stripeClient = await getUncachableStripeClient();
                productObj = await stripeClient.products.retrieve(productObj);
              } catch { /* ignore */ }
            }
            const productMeta = (productObj as any)?.metadata ?? {};
            planMeta = productMeta?.plan;
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
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        trialEndsAt: trialEndsAt ?? undefined,
      }).where(eq(users.id, user.id));

      log(`Stripe webhook: updated user ${user.id} plan → ${plan}`, 'stripe');
    } catch (err: any) {
      log(`Stripe webhook plan sync error: ${err?.message}`, 'stripe');
    }
  }
}
