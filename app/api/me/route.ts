import { db, ensureProfile, fee, getUser, imageUrl, isAdmin, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Profilo, crediti, aree e ordini dell'utente. Crea il profilo al primo accesso.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Accedi per continuare' }, 401);
  const profile = await ensureProfile(user, req.headers.get('x-ref'));
  db.rpc('touch_seen', { p_user: user.id }); // ultimo online, senza bloccare la risposta
  const [credits, areas, orders] = await Promise.all([
    db.rpc('credit_balance', { p_user: user.id }),
    db.from('areas').select('id,x,y,w,h,image_path,link,message,created_at').eq('owner', user.id).eq('status', 'active').order('id'),
    db.from('orders').select('id,pixels,paid_pixels,credits_used,bonus_pixels,amount_cents,status,created_at').eq('user_id', user.id).order('id', { ascending: false }).limit(50),
  ]);
  return json({
    profile,
    admin: isAdmin(user),
    fee,
    credits: credits.data ?? 0,
    areas: (areas.data ?? []).map(({ image_path, ...a }) => ({ ...a, image_url: imageUrl(image_path) })),
    orders: orders.data ?? [],
  });
}

// Scelta del nome visibile in classifica.
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Accedi per continuare' }, 401);
  await ensureProfile(user, req.headers.get('x-ref'));
  const raw = (await req.json().catch(() => ({}))).username;
  const username = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  if (username.length < 3 || username.length > 20 || !/^[A-Za-z0-9._-]+( [A-Za-z0-9._-]+)*$/.test(username))
    return json({ error: 'Nome: da 3 a 20 caratteri tra lettere, numeri, spazio, punto, trattino e _ (niente spazi iniziali/finali)' }, 400);
  const { error } = await db.from('profiles').update({ username }).eq('id', user.id);
  if (error) return json({ error: error.code === '23505' ? 'Nome già preso' : error.message }, 400);
  return json({ ok: true });
}
