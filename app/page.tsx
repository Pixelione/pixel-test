'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AreaCard from '@/components/AreaCard';
import CanvasView from '@/components/CanvasView';
import { LEGAL } from '@/components/Footer';
import { BONUS_EVERY, CANVAS, REFERRAL_PIXELS, type Area } from '@/lib/config';

const TOTAL = CANVAS * CANVAS;
const at = (areas: Area[], x: number, y: number) => areas.find((a) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) ?? null;
const n = (v: number) => v.toLocaleString('it-IT');

export default function Home() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [open, setOpen] = useState<Area | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [info, setInfo] = useState(false);

  useEffect(() => {
    let etag = '';
    // ETag → 304 quando nulla cambia. Primo caricamento sempre; il polling va in pausa a scheda nascosta.
    const load = async () => {
      try {
        // no-store: niente rivalidazione automatica del browser (darebbe 304 senza corpo); l'ETag lo gestiamo noi.
        const r = await fetch('/api/areas', { cache: 'no-store', headers: etag ? { 'if-none-match': etag } : {} });
        if (r.status === 304) return;
        etag = r.headers.get('etag') || '';
        if (r.ok) setAreas(await r.json());
      } catch {}
    };
    load();
    const t = setInterval(() => document.hidden || load(), 15000);
    const onVisible = () => !document.hidden && load();
    document.addEventListener('visibilitychange', onVisible);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (setInfo(false), setOpen(null));
    addEventListener('keydown', esc);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('keydown', esc);
    };
  }, []);

  const sold = areas.reduce((s, a) => s + a.w * a.h, 0);
  const latest = areas.slice(-12).reverse(); // id crescente = ordine di acquisto
  const roll = latest.length >= 4; // scorre solo se c'è abbastanza da far scorrere
  const hovered = hover && at(areas, hover.x, hover.y);
  const desktop = typeof window !== 'undefined' && matchMedia('(min-width: 640px)').matches; // letto solo al primo adattamento

  return (
    <div className="fixed inset-0 overflow-hidden">
      <CanvasView
        className="absolute inset-0 overflow-hidden"
        pad={desktop ? [76, 24, 100, 24] : [120, 12, 150, 12]}
        controlsClass="right-3 bottom-[136px] sm:right-4 sm:bottom-[112px]"
        areas={areas}
        highlight={open ? [open] : []}
        onCell={(x, y) => setOpen(at(areas, x, y))}
        onHover={(c, cx, cy) => setHover(c ? { x: c[0], y: c[1], cx, cy } : null)}
      />

      {/* Contatore: sotto la barra su telefono, al centro in alto su computer. */}
      <div className="pointer-events-none absolute inset-x-0 top-[64px] flex justify-center px-3 sm:top-4">
        <div className="glass pill pointer-events-auto h-11 gap-3 pr-3">
          <span className="flex items-center gap-1.5 font-pixel text-[11px] text-ok">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:hidden" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
            LIVE
          </span>
          <span className="font-mono text-[13px]"><b className="text-gold">{n(sold)}</b> <span className="text-white/50">venduti</span></span>
          <span className="hidden font-mono text-[13px] min-[380px]:inline"><b>{n(TOTAL - sold)}</b> <span className="text-white/50">liberi</span></span>
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10 sm:w-24" aria-hidden>
            <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.max(1.5, (sold / TOTAL) * 100)}%` }} />
          </span>
        </div>
      </div>

      {/* Tooltip col mouse. */}
      {hover && (
        <div className="glass pointer-events-none fixed z-30 rounded-xl px-3 py-2 text-xs" style={{ left: hover.cx + 16, top: hover.cy + 16 }}>
          {hovered ? (
            <>
              <p className="font-semibold text-sm">{hovered.username}</p>
              <p className="font-mono text-white/55">{hovered.w}×{hovered.h} · {n(hovered.w * hovered.h)} px</p>
            </>
          ) : (
            <p className="font-mono"><span className="text-ok">Libero</span> <span className="text-white/50">· {hover.x}, {hover.y}</span></p>
          )}
        </div>
      )}

      {/* In basso: come funziona, compra, ultimi acquisti. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3 px-3 sm:px-4">
          <button type="button" onClick={() => setInfo(true)} aria-label="Come funziona" className="glass pill pointer-events-auto h-12 whitespace-nowrap px-3.5 font-pixel text-[11px] tracking-wider text-white/80 hover:text-white sm:px-4">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-white/10 text-[10px]">?</span>
            <span className="hidden sm:inline">COME FUNZIONA</span>
          </button>
          <Link href="/compra" className="btn pointer-events-auto h-14 whitespace-nowrap rounded-2xl px-5 text-base sm:px-6">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden className="fill-current"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" /></svg>
            Compra pixel
            <span className="rounded-md bg-bg/15 px-1.5 py-0.5 font-mono text-xs">1 €/px</span>
          </Link>
        </div>
        <div className="glass pointer-events-auto flex h-11 items-center overflow-hidden border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]">
          <span className="z-10 flex h-full shrink-0 items-center bg-gold px-3 font-pixel text-[11px] text-bg">ULTIMI</span>
          {latest.length === 0 ? (
            <span className="px-4 text-sm text-white/55">Tela appena aperta: il primo acquisto finisce qui.</span>
          ) : (
            <div className="flex min-w-0 flex-1 overflow-hidden">
              <div className={`flex shrink-0 gap-8 pr-8 ${roll ? 'ticker hover:[animation-play-state:paused]' : 'pl-4'}`}>
                {(roll ? [...latest, ...latest] : latest).map((a, i) => (
                  <button key={i} type="button" aria-hidden={i >= latest.length} tabIndex={i >= latest.length ? -1 : 0} onClick={() => setOpen(a)} className="flex shrink-0 items-center gap-2 text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.image_url} alt="" className="h-6 w-6 rounded bg-black object-contain" />
                    <b>{a.username}</b>
                    <span className="font-mono text-white/50">{n(a.w * a.h)} px</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {open && <AreaCard area={open} onClose={() => setOpen(null)} />}

      {info && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={() => setInfo(false)}>
          <div role="dialog" aria-modal aria-labelledby="info-title" className="glass rise max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label">Un milione di pixel</p>
                <h2 id="info-title" className="mt-1 text-2xl font-bold">Prenditi un pezzo di internet.</h2>
              </div>
              <button type="button" onClick={() => setInfo(false)} aria-label="Chiudi" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-white/60 hover:bg-white/10 hover:text-white">×</button>
            </div>
            <ol className="mt-5 space-y-3">
              {[
                ['Carica', 'Scegli un\'immagine e decidi con la barra quanti pixel usare: più grande, più dettagli.'],
                ['Posiziona', 'Tocca un punto libero della tela. Aggiungi link e messaggio.'],
                ['Resta lì', 'Paghi 1 € a pixel e la tua area appare subito, per sempre.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold font-pixel text-sm text-bg">{i + 1}</span>
                  <p className="text-sm text-white/75"><b className="text-ink">{t}.</b> {d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <p className="card p-3 text-sm"><b className="text-gold">+1 pixel</b> omaggio ogni {BONUS_EVERY} pagati.</p>
              <p className="card p-3 text-sm"><b className="text-gold">+{REFERRAL_PIXELS} pixel</b> per ogni amico che inviti e compra.</p>
            </div>
            <Link href="/compra" className="btn mt-5 w-full">Inizia</Link>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
              {LEGAL.map(([h, l]) => <a key={h} href={h} className="hover:text-white">{l}</a>)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
