import { db, imageUrl, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Dettaglio pubblico di un'area: profilo, rank di sempre, ultimo online, messaggio, coordinate. Niente email.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return json({ error: 'id non valido' }, 400);
  const { data, error } = await db.rpc('area_detail', { p_id: id });
  if (error) return json({ error: error.message }, 500);
  const a = data?.[0];
  if (!a) return json({ error: 'Area non trovata' }, 404);
  const { image_path, ...rest } = a;
  return json({ ...rest, image_url: imageUrl(image_path) });
}
