'use client';
import { useEffect, useState } from 'react';
import { api, supabase } from '@/lib/browser';
import type { Area } from '@/lib/config';

type Detail = {
  id: number; x: number; y: number; w: number; h: number; image_url: string;
  link: string | null; message: string | null; username: string;
  owner_pixels: number; owner_areas: number; rank: number | null;
  last_seen: string | null; member_since: string;
};

const REASONS: [string, string][] = [
  ['spam', 'Spam'],
  ['offensive', 'Offensivo'],
  ['scam', 'Truffa'],
  ['impersonation', 'Impersonificazione'],
  ['other', 'Altro'],
];
const n = (v: number) => v.toLocaleString('it-IT');

// Da quanto tempo: "ora", "5 min fa", "3 h fa", "2 g fa".
function ago(iso: string | null) {
  if (!iso) return null;
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'ora';
  if (s < 3600) return `${Math.round(s / 60)} min fa`;
  if (s < 86400) return `${Math.round(s / 3600)} h fa`;
  return `${Math.round(s / 86400)} g fa`;
}

export default function AreaCard({ area, onClose }: { area: Area; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    setD(null); setReporting(false); setSent(false); setErr(''); setReason(''); setNote('');
    fetch(`/api/area/${area.id}`).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
    supabase.auth.getSession().then(({ data }) => setLogged(!!data.session));
  }, [area.id]);

  const send = async () => {
    setBusy(true); setErr('');
    try {
      await api('/api/report', { method: 'POST', body: JSON.stringify({ area_id: area.id, reason, note }) });
      setSent(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const seen = ago(d?.last_seen ?? null);

  return (
    <div role="dialog" aria-label="Dettagli area" className="glass rise fixed inset-x-3 bottom-[124px] z-30 mx-auto max-w-md rounded-3xl p-4 sm:bottom-[112px]">
      {!reporting ? (
        <>
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={area.image_url} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-white/10 bg-black object-contain" style={{ imageRendering: 'pixelated' }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-bold leading-tight">{d?.username ?? area.username}</p>
                {d?.rank != null && <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 font-pixel text-[10px] text-gold">#{d.rank}</span>}
              </div>
              <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-xs text-white/50">
                <span>{area.w}×{area.h} = {n(area.w * area.h)} px</span>
                <span>· {area.x}, {area.y}</span>
                {seen && <span>· online {seen}</span>}
              </p>
              {d && (
                <p className="mt-1 font-mono text-[11px] text-white/40">
                  {n(d.owner_pixels)} px in {d.owner_areas} {d.owner_areas === 1 ? 'area' : 'aree'}
                </p>
              )}
              {area.message && <p className="mt-2 break-words text-sm text-white/85">{area.message}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Chiudi" className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-xl text-white/60 hover:bg-white/10 hover:text-white">×</button>
          </div>
          <div className="mt-4 flex gap-2">
            {area.link && (
              <a href={area.link} target="_blank" rel="sponsored noopener noreferrer" className="btn flex-1">
                Visita <span className="truncate font-normal opacity-70">{area.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setReporting(true)}
              aria-label="Segnala questa area"
              title="Segnala"
              className={`btn-ghost ${area.link ? 'w-12 px-0' : 'flex-1'}`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="fill-current"><path d="M5 3h14l-3 5 3 5H7v8H5z" /></svg>
              {!area.link && <span>Segnala</span>}
            </button>
          </div>
        </>
      ) : sent ? (
        <div className="space-y-3 py-2 text-center">
          <p className="text-lg font-semibold">Grazie per la segnalazione.</p>
          <p className="text-sm text-white/60">La controlleremo. Se viola le regole, l&apos;area verrà rimossa.</p>
          <button type="button" className="btn w-full" onClick={onClose}>Chiudi</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Segnala quest&apos;area</h3>
            <button type="button" onClick={() => setReporting(false)} aria-label="Indietro" className="text-sm text-white/50 hover:text-white">← indietro</button>
          </div>
          {!logged ? (
            <p className="text-sm text-white/70">Accedi per segnalare un&apos;area. <a href="/accedi" className="text-gold underline">Accedi</a></p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {REASONS.map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setReason(k)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${reason === k ? 'border-gold bg-gold/10 text-gold' : 'border-white/12 text-white/75 hover:bg-white/5'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <input className="input" maxLength={300} placeholder="Dettagli (facoltativo)" value={note} onChange={(e) => setNote(e.target.value)} />
              {err && <p role="alert" className="text-sm text-bad">{err}</p>}
              <button type="button" className="btn w-full" disabled={!reason || busy} onClick={send}>
                {busy ? 'Invio…' : 'Invia segnalazione'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
