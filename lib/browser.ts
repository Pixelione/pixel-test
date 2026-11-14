'use client';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

// fetch verso le nostre API con il token dell'utente e l'eventuale codice invito.
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set('authorization', `Bearer ${data.session.access_token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  try {
    const ref = localStorage.getItem('ref');
    if (ref) headers.set('x-ref', ref);
  } catch {}
  const r = await fetch(path, { ...init, headers });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Errore ${r.status}`);
  return body;
}
