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
  referrals: number;
  areas: { id: number; x: number; y: number; w: number; h: number; image_url: string; link: string | null; message: string | null; clicks: number }[];
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
  const shareInvite = async () => {
    const text = 'Prenditi un pezzo di tela su PIXELIONE: un milione di pixel, 1 € l\'uno.';
    try {
      if (navigator.share) await navigator.share({ title: 'PIXELIONE', text, url: invite });
      else { await navigator.clipboard.writeText(invite); setCopied(true); }
    } catch {}
  };
  const totalClicks = me.areas.reduce((n, a) => n + (a.clicks || 0), 0);

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

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat l="Pixel sulla tela" v={me.areas.reduce((n, a) => n + a.w * a.h, 0)} />
        <Stat l="Pixel omaggio" v={me.credits} gold />
        <Stat l="Click ricevuti" v={totalClicks} />
        <Stat l="Invitati" v={me.referrals} />
      </div>

      <section className="card space-y-2">
        <h2 className="font-semibold">Invita e guadagna {REFERRAL_PIXELS} pixel</h2>
        <p className="text-sm text-white/65">Quando qualcuno crea l&apos;account dal tuo link e fa il primo acquisto, ricevi {REFERRAL_PIXELS} pixel omaggio. Hai già invitato <b className="text-gold">{me.referrals}</b> {me.referrals === 1 ? 'persona' : 'persone'}.</p>
        <div className="flex gap-2">
          <input readOnly className="input font-mono text-sm" value={invite} aria-label="Link di invito" onFocus={(e) => e.target.select()} />
          <button type="button" className="btn-ghost" onClick={() => navigator.clipboard.writeText(invite).then(() => setCopied(true))}>{copied ? 'Copiato' : 'Copia'}</button>
          <button type="button" className="btn" onClick={shareInvite}>Condividi</button>
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
            <li key={a.id} className="card space-y-2 py-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.image_url} alt="" className="h-14 w-14 rounded bg-black object-contain" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-mono">{a.w}×{a.h} · {a.x},{a.y} · <span className="text-gold">{(a.clicks || 0).toLocaleString('it-IT')} click</span></p>
                  {a.message && <p className="truncate text-white/65">{a.message}</p>}
                  {a.link && <p className="truncate text-white/45">{a.link}</p>}
                </div>
              </div>
              <AreaShare id={a.id} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-white/45">I click contano quante volte qualcuno ha aperto il tuo link dalla tela. Immagine e link non si cambiano dopo l&apos;acquisto; per problemi scrivi a f3013032@gmail.com.</p>
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

// Condividi l'area e codice badge da incollare sul proprio sito (link di ritorno).
function AreaShare({ id }: { id: number }) {
  const [done, setDone] = useState('');
  const url = typeof window !== 'undefined' ? `${location.origin}/a/${id}` : '';
  const badge = `<a href="${url}"><img src="${typeof window !== 'undefined' ? location.origin : ''}/badge.svg" alt="Sono su PIXELIONE" width="160" height="40"></a>`;
  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => { setDone(what); setTimeout(() => setDone(''), 1500); });
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'PIXELIONE', text: 'La mia area su PIXELIONE', url });
      else copy(url, 'link');
    } catch {}
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1 py-1.5 text-xs" onClick={share}>{done === 'link' ? 'Copiato' : 'Condividi area'}</button>
        <a href={url} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-xs">Apri</a>
      </div>
      <details className="text-xs text-white/55">
        <summary className="cursor-pointer select-none">Codice badge per il tuo sito</summary>
        <code className="mt-1 block break-all rounded bg-black/40 p-2 font-mono text-[10px] text-white/70">{badge}</code>
        <button type="button" className="btn-ghost mt-1 py-1 text-xs" onClick={() => copy(badge, 'badge')}>{done === 'badge' ? 'Copiato' : 'Copia codice'}</button>
      </details>
    </div>
  );
}
