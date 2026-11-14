import { overlaps } from '@/lib/config';
import { db, getUser, imageUrl, isAdmin, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

const SELECT = 'id,x,y,w,h,image_path,link,message,created_at,owner,profiles(username,email)';
const shape = ({ image_path, profiles, ...a }: any) => ({ ...a, image_url: imageUrl(image_path), username: profiles?.username, email: profiles?.email });

// ?q=nome o email -> aree di quell'account. ?x=&y=&w=&h= -> aree dentro il rettangolo.
export async function GET(req: Request) {
  if (!isAdmin(await getUser(req))) return json({ error: 'Solo admin' }, 403);
  const p = new URL(req.url).searchParams;
  if (p.get('reports')) {
    const { data, error } = await db.rpc('reports_summary', { p_limit: 100 });
    if (error) return json({ error: error.message }, 500);
    return json({ reports: (data ?? []).map(({ image_path, ...a }: any) => ({ ...a, image_url: imageUrl(image_path) })) });
  }
  const q = p.get('q')?.trim();
  if (q) {
    // Escape dei metacaratteri PostgREST/LIKE; niente stringa .or costruita a mano con input grezzo.
    const term = `%${q.replace(/[\\%_,().*:]/g, (c) => '\\' + c)}%`;
    const { data: users } = await db
      .from('profiles')
      .select('id,username,email')
      .or(`username.ilike.${term},email.ilike.${term}`)
      .limit(20);
    const ids = (users ?? []).map((u) => u.id);
    const { data } = ids.length ? await db.from('areas').select(SELECT).eq('status', 'active').in('owner', ids).order('id') : { data: [] };
    const balances = await Promise.all(ids.map((id) => db.rpc('credit_balance', { p_user: id }).then((r) => r.data ?? 0)));
    return json({ users: (users ?? []).map((u, i) => ({ ...u, credits: balances[i] })), areas: (data ?? []).map(shape) });
  }
  const rect = { x: Number(p.get('x')), y: Number(p.get('y')), w: Number(p.get('w')), h: Number(p.get('h')) };
  if (Object.values(rect).some((v) => !Number.isFinite(v))) return json({ error: 'Cerca un account o seleziona un rettangolo' }, 400);
  // shortcut: filtro in memoria su tutte le aree attive; con decine di migliaia di aree spostarlo in SQL.
  const { data, error } = await db.from('areas').select(SELECT).eq('status', 'active').order('id');
  if (error) return json({ error: error.message }, 500);
  return json({ users: [], areas: data.filter((a) => overlaps(a, rect)).map(shape) });
}

// Cancella le aree scelte e riaccredita i pixel ai proprietari.
export async function POST(req: Request) {
  if (!isAdmin(await getUser(req))) return json({ error: 'Solo admin' }, 403);
  const { ids, reason } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || !ids.length || !ids.every(Number.isInteger)) return json({ error: 'Nessuna area selezionata' }, 400);
  const { data, error } = await db.rpc('admin_remove_areas', { p_ids: ids, p_reason: String(reason ?? 'admin').slice(0, 200) });
  if (error) return json({ error: error.message }, 500);
  return json({ removed: data });
}
