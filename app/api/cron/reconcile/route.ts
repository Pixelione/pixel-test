import { db, json, stripe } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Manutenzione periodica: libera i lock scaduti e riconcilia gli ordini 'pending' vecchi con Stripe
// (recupera i pagamenti il cui webhook si fosse perso). Protetto da CRON_SECRET.
// Pianificare con Vercel Cron o Supabase Scheduled: GET /api/cron/reconcile con header 'authorization: Bearer <CRON_SECRET>'.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'non autorizzato' }, 401);

  await db.rpc('release_expired');

  // Ordini ancora in sospeso da più di 15 minuti con una sessione Stripe: chiedi lo stato vero.
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stale } = await db
    .from('orders')
    .select('id,stripe_session_id')
    .eq('status', 'pending')
    .not('stripe_session_id', 'is', null)
    .lt('created_at', cutoff)
    .limit(100);

  let completed = 0, expired = 0;
  for (const o of stale ?? []) {
    try {
      const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id!);
      if (s.payment_status === 'paid') {
        await db.rpc('complete_order', { p_order: o.id, p_session: s.id, p_payment_intent: typeof s.payment_intent === 'string' ? s.payment_intent : null });
        completed++;
      } else if (s.status === 'expired') {
        await db.rpc('expire_order', { p_order: o.id });
        expired++;
      }
    } catch {
      // sessione non recuperabile: la lascia al prossimo giro
    }
  }
  return json({ ok: true, checked: stale?.length ?? 0, completed, expired });
}
