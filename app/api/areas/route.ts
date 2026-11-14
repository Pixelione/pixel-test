import { db, imageUrl, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Aree pubblicate sulla tela.
export async function GET() {
  const { data, error } = await db
    .from('areas')
    .select('id,x,y,w,h,image_path,link,message,profiles(username)')
    .eq('status', 'active')
    .order('id');
  if (error) return json({ error: error.message }, 500);
  return json(
    data.map(({ image_path, profiles, ...a }: any) => ({ ...a, image_url: imageUrl(image_path), username: profiles?.username ?? 'anonimo' })),
  );
}
