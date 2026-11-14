import { db, ensureProfile, getUser, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

const REASONS = ['spam', 'offensive', 'scam', 'impersonation', 'other'];

// Segnalazione di un'area. Autenticata e con rate limit: una per utente per area (aggiornabile).
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Accedi per segnalare' }, 401);
  await ensureProfile(user, req.headers.get('x-ref')); // il segnalante deve avere un profilo (FK)

  const { data: allowed } = await db.rpc('rate_hit', { p_key: `report:${user.id}`, p_limit: 20, p_window_secs: 3600 });
  if (allowed === false) return json({ error: 'Troppe segnalazioni, riprova più tardi' }, 429);

  const { area_id, reason, note } = await req.json().catch(() => ({}));
  if (!Number.isInteger(area_id) || !REASONS.includes(reason)) return json({ error: 'Segnalazione non valida' }, 400);

  const { error } = await db.rpc('submit_report', {
    p_reporter: user.id,
    p_area: area_id,
    p_reason: reason,
    p_note: typeof note === 'string' ? note.slice(0, 300) : null,
  });
  if (error) {
    if (error.message?.includes('area-propria')) return json({ error: 'Non puoi segnalare la tua area' }, 400);
    if (error.message?.includes('area-inesistente')) return json({ error: 'Area non trovata' }, 404);
    return json({ error: 'Segnalazione fallita' }, 500);
  }
  await db.rpc('touch_seen', { p_user: user.id });
  return json({ ok: true });
}
