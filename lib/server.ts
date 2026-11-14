// Solo server: chiavi segrete, utente dalla richiesta, profilo.
import { createClient, type User } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-10-28.endive' });

// Moderazione immagini opzionale: se configurata, invia il PNG a un servizio esterno che risponde
// { allowed: boolean }. Senza configurazione non blocca nulla (resta la rimozione admin + segnalazioni).
export async function moderateImage(png: Buffer): Promise<boolean> {
  const url = process.env.MODERATION_API_URL;
  if (!url) return true;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream', ...(process.env.MODERATION_API_KEY ? { authorization: `Bearer ${process.env.MODERATION_API_KEY}` } : {}) },
      body: new Uint8Array(png),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return true; // servizio giù: non blocchiamo l'acquisto, l'admin vigila
    const d = await r.json().catch(() => ({ allowed: true }));
    return d.allowed !== false;
  } catch {
    return true;
  }
}

export const fee = {
  percent: Number(process.env.STRIPE_FEE_PERCENT ?? 1.5),
  fixedCents: Number(process.env.STRIPE_FEE_FIXED_CENTS ?? 25),
};

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export const siteUrl = (req: Request) => process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

// Utente dal token Supabase nell'intestazione Authorization (mandato da lib/api.ts).
export async function getUser(req: Request): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error ? null : data.user;
}

export const isAdmin = (user: User | null) =>
  !!user?.email &&
  (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).includes(user.email.toLowerCase());

// Iscritto confermato alla lista d'attesa pre-lancio? Senza configurazione: no.
async function isEarlyBird(email: string) {
  const url = process.env.PRELAUNCH_SUPABASE_URL, key = process.env.PRELAUNCH_SUPABASE_SECRET_KEY;
  if (!url || !key) return false;
  const q = `${url}/rest/v1/iscritti?select=id&stato=eq.confermato&email=eq.${encodeURIComponent(email.toLowerCase())}`;
  const r = await fetch(q, { headers: { apikey: key, ...(key.startsWith('sb_') ? {} : { authorization: `Bearer ${key}` }) } });
  return r.ok && (await r.json()).length > 0;
}

export type Profile = { id: string; email: string; username: string | null; ref_code: string; early_bird: boolean };

// Crea il profilo al primo accesso, con l'eventuale codice invito.
export async function ensureProfile(user: User, refCode?: string | null): Promise<Profile> {
  const { data } = await db.from('profiles').select('id,email,username,ref_code,early_bird').eq('id', user.id).maybeSingle();
  if (data) return data;
  let referred_by: string | null = null;
  if (refCode) {
    const { data: ref } = await db.from('profiles').select('id').eq('ref_code', refCode).maybeSingle();
    if (ref && ref.id !== user.id) referred_by = ref.id;
  }
  const early_bird = await isEarlyBird(user.email!).catch(() => false);
  const { data: created, error } = await db
    .from('profiles')
    .upsert({ id: user.id, email: user.email!, referred_by, early_bird }, { onConflict: 'id', ignoreDuplicates: true })
    .select('id,email,username,ref_code,early_bird')
    .maybeSingle();
  if (error) throw error;
  if (created) return created;
  const { data: again } = await db.from('profiles').select('id,email,username,ref_code,early_bird').eq('id', user.id).single();
  return again!;
}

export const imageUrl = (path: string) => db.storage.from('areas').getPublicUrl(path).data.publicUrl;
