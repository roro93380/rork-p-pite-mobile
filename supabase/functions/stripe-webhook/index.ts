// supabase/functions/stripe-webhook/index.ts
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
//
// Configure in Stripe Dashboard → Webhooks:
//   URL: https://didkwpenayulngybldkc.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
//
// Env var needed: STRIPE_WEBHOOK_SECRET (whsec_xxx)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const planId = session.metadata?.plan_id;

      if (userId && planId) {
        await supabase
          .from('profiles')
          .update({
            subscription_tier: planId, // 'gold' or 'platinum'
            stripe_customer_id: session.customer as string,
          })
          .eq('id', userId);

        console.log(`✅ User ${userId} subscribed to ${planId}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Trouver le user par stripe_customer_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        if (subscription.status === 'active') {
          // Déterminer le plan à partir du price ID
          const priceId = subscription.items.data[0]?.price?.id;
          let tier = 'free';
          if (priceId === Deno.env.get('STRIPE_PRICE_GOLD')) tier = 'gold';
          else if (priceId === Deno.env.get('STRIPE_PRICE_PLATINUM')) tier = 'platinum';

          await supabase
            .from('profiles')
            .update({ subscription_tier: tier })
            .eq('id', profile.id);

          console.log(`✅ Subscription updated: user ${profile.id} → ${tier}`);
        } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
          await supabase
            .from('profiles')
            .update({ subscription_tier: 'free' })
            .eq('id', profile.id);

          console.log(`⚠️ Subscription ${subscription.status}: user ${profile.id} → free`);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: 'free' })
          .eq('id', profile.id);

        console.log(`❌ Subscription deleted: user ${profile.id} → free`);
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
