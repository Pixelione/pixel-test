import type Stripe from 'stripe';
import { db, json, stripe } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Unica fonte di verità per assegnare i pixel: firma verificata, funzioni SQL idempotenti.
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return json({ error: 'firma mancante' }, 400);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return json({ error: 'firma non valida' }, 400);
  }

  const orderOf = (s: Stripe.Checkout.Session) => Number(s.metadata?.order_id);
  const byPaymentIntent = async (pi: string | Stripe.PaymentIntent | null) => {
    const id = typeof pi === 'string' ? pi : pi?.id;
    if (!id) return null;
    const { data } = await db.from('orders').select('id').eq('stripe_payment_intent', id).maybeSingle();
    if (data) return data.id as number;
    const p = await stripe.paymentIntents.retrieve(id);
    return Number(p.metadata?.order_id) || null;
  };

  let error = null;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object;
      if (s.payment_status === 'paid')
        ({ error } = await db.rpc('complete_order', { p_order: orderOf(s), p_session: s.id, p_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : null }));
      break;
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      ({ error } = await db.rpc('expire_order', { p_order: orderOf(event.data.object) }));
      break;
    case 'charge.refunded': {
      const c = event.data.object;
      // Solo rimborso totale libera l'area. shortcut: rimborsi parziali ignorati, gestirli a mano da Stripe.
      if (c.refunded) {
        const id = await byPaymentIntent(c.payment_intent);
        if (id) ({ error } = await db.rpc('refund_order', { p_order: id }));
      }
      break;
    }
    case 'charge.dispute.created': {
      const id = await byPaymentIntent(event.data.object.payment_intent);
      if (id) ({ error } = await db.rpc('refund_order', { p_order: id }));
      break;
    }
  }
  if (error) {
    console.error('webhook', event.type, error);
    return json({ error: 'errore database' }, 500); // Stripe riprova
  }
  return json({ received: true });
}
