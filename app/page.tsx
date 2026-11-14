'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import CanvasView from '@/components/CanvasView';
import { CANVAS, type Area } from '@/lib/config';

export default function Home() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [open, setOpen] = useState<Area | null>(null);

  useEffect(() => {
    const load = () => fetch('/api/areas').then((r) => (r.ok ? r.json() : [])).then(setAreas).catch(() => {});
    load();
    // shortcut: aggiornamento ogni 15 s; per il tempo reale vero passare a Supabase Realtime.
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const sold = areas.reduce((n, a) => n + a.w * a.h, 0);

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Un milione di pixel. 1 € l&apos;uno.</h1>
          <p className="mt-1 text-white/65">Compra un&apos;area, carica la tua immagine e il tuo link. Resta sulla tela per sempre.</p>
        </div>
        <Link href="/compra" className="btn">Compra pixel</Link>
      </section>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm">
        <span><b className="font-mono text-gold">{sold.toLocaleString('it-IT')}</b> pixel venduti</span>
        <span><b className="font-mono">{(CANVAS * CANVAS - sold).toLocaleString('it-IT')}</b> liberi</span>
        <div className="h-2 min-w-32 flex-1 overflow-hidden rounded bg-white/10" aria-hidden>
          <div className="h-full bg-gold" style={{ width: `${Math.max(0.3, (sold / (CANVAS * CANVAS)) * 100)}%` }} />
        </div>
      </div>

      <CanvasView
        areas={areas}
        highlight={open ? [open] : []}
        onCell={(x, y) => setOpen(areas.find((a) => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) ?? null)}
      />
      <p className="text-sm text-white/50">Trascina per spostarti, rotella o pizzico per lo zoom. Tocca un&apos;area per vedere di chi è.</p>

      {open && (
        <div role="dialog" aria-label="Dettagli area" className="card fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md shadow-2xl">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.image_url} alt="" className="h-16 w-16 rounded bg-black object-contain" style={{ imageRendering: 'pixelated' }} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{open.username}</p>
              <p className="text-xs text-white/50">{open.w}×{open.h} = {open.w * open.h} pixel · posizione {open.x},{open.y}</p>
              {open.message && <p className="mt-1 break-words text-sm">{open.message}</p>}
              {open.link && (
                <a href={open.link} target="_blank" rel="sponsored noopener noreferrer" className="mt-1 block truncate text-sm text-gold underline">
                  {open.link}
                </a>
              )}
            </div>
            <button type="button" onClick={() => setOpen(null)} aria-label="Chiudi" className="text-xl text-white/60 hover:text-white">×</button>
          </div>
        </div>
      )}
    </div>
  );
}
