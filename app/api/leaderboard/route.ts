import { db, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get('period');
  const period = p === 'day' || p === 'week' ? p : 'all';
  const { data, error } = await db.rpc('leaderboard', { p_period: period, p_limit: 100 });
  if (error) return json({ error: error.message }, 500);
  return json(data);
}
