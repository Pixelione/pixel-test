import { db, getUser, json, stripe } from '@/lib/server';

export const dynamic = 'force-dynamic';

async function load(req: Request, id: string) {
  const user = await getUser(req);
  if (!user) return null;
  const { data } = await db.from('orders').select('*').eq('id', Number(id)).eq('user_id', user.id).maybeSingle();
  return data;
}

// Stato dell'ordine. Se il webhook non è ancora arrivato, chiede a Stripe (stessa funzione idempotente).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const order = await load(req, (await params).id);
  if (!order) return json({ error: 'Ordine non trovato' }, 404);
  if (order.status === 'pending' && order.stripe_session_id) {
    const s = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    if (s.payment_status === 'paid') {
      await db.rpc('complete_order', { p_order: order.id, p_session: s.id, p_payment_intent: String(s.payment_intent ?? '') || null });
      order.status = 'paid';
    } else if (s.status === 'expired') {
      await db.rpc('expire_order', { p_order: order.id });
      order.status = 'expired';
    }
  }
  const { data: fresh } = await db.from('orders').select('id,pixels,paid_pixels,credits_used,bonus_pixels,amount_cents,fee_cents,status').eq('id', order.id).single();
  return json(fresh);
}

// "Annulla" dal checkout: chiude la sessione Stripe e libera subito l'area.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const order = await load(req, (await params).id);
  if (!order) return json({ error: 'Ordine non trovato' }, 404);
  if (order.status !== 'pending') return json({ status: order.status });
  if (order.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(order.stripe_session_id);
    } catch {
      // già pagata o già scaduta: decide il GET successivo
      return json({ status: 'pending' });
    }
  }
  await db.rpc('expire_order', { p_order: order.id });
  return json({ status: 'expired' });
}
