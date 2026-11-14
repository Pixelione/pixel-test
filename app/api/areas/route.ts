import { createHash } from 'node:crypto';
import { db, imageUrl, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Aree pubblicate sulla tela. ETag per polling leggero: se nulla è cambiato, risposta 304.
export async function GET(req: Request) {
  const { data, error } = await db
    .from('areas')
    .select('id,x,y,w,h,image_path,link,message,profiles(username)')
    .eq('status', 'active')
    .order('id');
  if (error) return json({ error: error.message }, 500);
  const body = data.map(({ image_path, profiles, ...a }: any) => ({ ...a, image_url: imageUrl(image_path), username: profiles?.username ?? 'anonimo' }));

  const etag = `"${createHash('sha1').update(JSON.stringify(body)).digest('base64').slice(0, 27)}"`;
  const headers = { 'cache-control': 'no-cache', etag };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return Response.json(body, { headers });
}
