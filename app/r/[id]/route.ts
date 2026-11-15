import { NextResponse } from 'next/server';
import { db, siteUrl } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Redirect che conta i click in uscita di un'area (ROI per lo sponsor), poi rimanda al link.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const home = new URL('/', siteUrl(req));
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.redirect(home, 302);
  const { data: link } = await db.rpc('bump_click', { p_id: id });
  const ok = typeof link === 'string' && /^https?:\/\//.test(link);
  return NextResponse.redirect(ok ? (link as string) : home, 302);
}
