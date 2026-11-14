'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import UsernameForm from '@/components/UsernameForm';
import { api, supabase } from '@/lib/browser';
import { REFERRAL_PIXELS, euro } from '@/lib/config';

type Me = {
  profile: { email: string; username: string | null; ref_code: string; early_bird: boolean };
  admin: boolean;
  credits: number;
  areas: { id: number; x: number; y: number; w: number; h: number; image_url: string; link: string | null; message: string | null }[];
  orders: { id: number; pixels: number; paid_pixels: number; credits_used: number; bonus_pixels: number; amount_cents: number; status: string; created_at: string }[];
};

const STATO: Record<string, string> = { paid: 'Pagato', pending: 'In attesa', expired: 'Scaduto', refunded: 'Rimborsato' };

export default function Profilo() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () => api<Me>('/api/me').then(setMe).catch((e) => setError(e.message));
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => (data.session ? load() : location.replace('/accedi?next=/profilo')));
  }, []);

  if (!me) return <p className="mt-10 text-center text-white/60">{error || 'Caricamento…'}</p>;
  const invite = `${location.origin}/?ref=${me.profile.ref_code}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{me.profile.username ?? 'Il tuo profilo'}</h1>
          <p className="text-sm text-white/50">{me.profile.email}{me.profile.early_bird && ' · iscritto prima del lancio'}</p>
        </div>
        <div className="flex gap-2">
          {me.admin && <Link href="/admin" className="btn-ghost">Admin</Link>}
          <button type="button" className="btn-ghost" onClick={() => supabase.auth.signOut().then(() => location.replace('/'))}>Esci</button>
        </div>
      </div>

      {!me.profile.username && <div className="card"><UsernameForm onDone={load} /></div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat l="Pixel sulla tela" v={me.areas.reduce((n, a) => n + a.w * a.h, 0)} />
        <Stat l="Pixel omaggio" v={me.credits} gold />
        <Stat l="Aree" v={me.areas.length} />
      </div>

      <section className="card space-y-2">
        <h2 className="font-semibold">Invita e guadagna {REFERRAL_PIXELS} pixel</h2>
        <p className="text-sm text-white/65">Quando qualcuno crea l&apos;account dal tuo link e fa il primo acquisto, ricevi {REFERRAL_PIXELS} pixel omaggio.</p>
        <div className="flex gap-2">
          <input readOnly className="input font-mono text-sm" value={invite} aria-label="Link di invito" onFocus={(e) => e.target.select()} />
          <button type="button" className="btn" onClick={() => navigator.clipboard.writeText(invite).then(() => setCopied(true))}>{copied ? 'Copiato' : 'Copia'}</button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Le tue aree</h2>
          <Link href="/compra" className="text-sm text-gold underline">Compra altri pixel</Link>
        </div>
        {me.areas.length === 0 && <p className="text-white/50">Ancora nessuna. La prima ti aspetta.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {me.areas.map((a) => (
            <li key={a.id} className="card flex items-center gap-3 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image_url} alt="" className="h-14 w-14 rounded bg-black object-contain" style={{ imageRendering: 'pixelated' }} />
              <div className="min-w-0 text-sm">
                <p className="font-mono">{a.w}×{a.h} · {a.x},{a.y}</p>
                {a.message && <p className="truncate text-white/65">{a.message}</p>}
                {a.link && <p className="truncate text-gold">{a.link}</p>}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-white/45">Immagine e link non si cambiano dopo l&apos;acquisto. Per problemi scrivi a info@pixelione.com.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Ordini</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white/50">
              <tr><th className="py-2 pr-3">#</th><th className="pr-3">Data</th><th className="pr-3">Pixel</th><th className="pr-3">Omaggio</th><th className="pr-3">Totale</th><th>Stato</th></tr>
            </thead>
            <tbody>
              {me.orders.map((o) => (
                <tr key={o.id} className="border-t border-white/10">
                  <td className="py-2 pr-3 font-mono">{o.id}</td>
                  <td className="pr-3">{new Date(o.created_at).toLocaleDateString('it-IT')}</td>
                  <td className="pr-3 font-mono">{o.pixels}</td>
                  <td className="pr-3 font-mono">{o.bonus_pixels ? `+${o.bonus_pixels}` : '—'}</td>
                  <td className="pr-3 font-mono">{euro(o.amount_cents)}</td>
                  <td>{STATO[o.status] ?? o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const Stat = ({ l, v, gold }: { l: string; v: number; gold?: boolean }) => (
  <div className="card">
    <p className="text-sm text-white/55">{l}</p>
    <p className={`font-mono text-2xl font-bold ${gold ? 'text-gold' : ''}`}>{v.toLocaleString('it-IT')}</p>
  </div>
);
