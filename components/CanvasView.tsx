'use client';
import { useEffect, useRef, useState } from 'react';
import { CANVAS, type Area } from '@/lib/config';

type Rect = { x: number; y: number; w: number; h: number };
type Props = {
  areas: Area[];
  ghost?: (Rect & { src?: string; ok: boolean }) | null; // area in acquisto
  highlight?: Rect[]; // aree selezionate (admin) o aperte
  selecting?: boolean; // trascina per disegnare un rettangolo invece di spostare la tela
  onCell?: (x: number, y: number) => void;
  onRect?: (r: Rect) => void;
  onHover?: (cell: [number, number] | null, clientX: number, clientY: number) => void; // solo mouse
  className?: string; // posizione e dimensioni del contenitore
  pad?: [number, number, number, number]; // spazio coperto da pannelli (alto, destra, basso, sinistra) per centrare la tela
  controlsClass?: string; // dove mettere i pulsanti dello zoom
};

const MIN = 0.2, MAX = 40;

// Tela 1000x1000: un pixel di tela = un pixel dell'immagine. Zoom con rotella, pizzico o pulsanti; trascina per spostare.
export default function CanvasView({
  areas, ghost, highlight = [], selecting, onCell, onRect, onHover,
  className = 'relative h-[70vh] overflow-hidden rounded-2xl border border-white/10',
  pad = [16, 16, 16, 16], controlsClass = 'bottom-3 right-3',
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const [sel, setSel] = useState<Rect | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; moved: number; cell: [number, number]; pinch?: number } | null>(null);
  const hoverCell = useRef('');
  const imgCache = useRef(new Map<string, HTMLImageElement>()); // immagini aree già scaricate

  // Adatta la tela allo spazio libero tra i pannelli.
  const fit = () => {
    const el = box.current!;
    const [t, r, b, l] = pad;
    const w = el.clientWidth - l - r, h = el.clientHeight - t - b;
    const s = Math.max(MIN, Math.min(w, h) / CANVAS);
    setView({ s, tx: l + (w - CANVAS * s) / 2, ty: t + (h - CANVAS * s) / 2 });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fit, []);

  // Disegna le aree vendute sul fondo.
  useEffect(() => {
    const ctx = cv.current!.getContext('2d')!;
    ctx.fillStyle = '#0e1120';
    ctx.fillRect(0, 0, CANVAS, CANVAS);
    let alive = true;
    // Scritta di fondo: la coprono le aree man mano che si vendono.
    document.fonts.ready.then(() => {
      if (!alive) return;
      const fam = getComputedStyle(document.body).getPropertyValue('--font-pixel') || 'monospace';
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.045)';
      ctx.textAlign = 'center';
      ctx.font = `700 118px ${fam}`;
      ctx.fillText('PIXELIONE', CANVAS / 2, CANVAS / 2);
      ctx.font = `400 34px ${fam}`;
      ctx.fillText('1.000.000 PIXEL · 1 € A PIXEL', CANVAS / 2, CANVAS / 2 + 64);
      ctx.restore();
      for (const a of areas) {
        const cached = imgCache.current.get(a.image_url);
        if (cached?.complete) {
          ctx.drawImage(cached, a.x, a.y, a.w, a.h);
          continue;
        }
        const img = cached ?? new Image();
        if (!cached) {
          img.src = a.image_url;
          imgCache.current.set(a.image_url, img); // riuso tra un aggiornamento e l'altro: niente ricarico
        }
        img.onload = () => alive && ctx.drawImage(img, a.x, a.y, a.w, a.h);
      }
    });
    return () => {
      alive = false;
    };
  }, [areas]);

  const cellAt = (cx: number, cy: number): [number, number] => {
    const r = box.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(CANVAS - 1, Math.floor((cx - r.left - view.tx) / view.s))),
      Math.max(0, Math.min(CANVAS - 1, Math.floor((cy - r.top - view.ty) / view.s))),
    ];
  };
  const inside = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    const x = (cx - r.left - view.tx) / view.s, y = (cy - r.top - view.ty) / view.s;
    return x >= 0 && y >= 0 && x < CANVAS && y < CANVAS;
  };

  const zoomAt = (cx: number, cy: number, f: number) =>
    setView((v) => {
      const r = box.current!.getBoundingClientRect();
      const s = Math.max(MIN, Math.min(MAX, v.s * f));
      const px = cx - r.left, py = cy - r.top;
      return { s, tx: px - ((px - v.tx) * s) / v.s, ty: py - ((py - v.ty) * s) / v.s };
    });

  useEffect(() => {
    const el = box.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) / 200));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      drag.current = { ...drag.current!, pinch: Math.hypot(a.x - b.x, a.y - b.y), moved: 99 };
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, moved: 0, cell: cellAt(e.clientX, e.clientY) };
  };

  const move = (e: React.PointerEvent) => {
    if (!drag.current || !ptrs.current.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && onHover) {
        const c = inside(e.clientX, e.clientY) ? cellAt(e.clientX, e.clientY) : null;
        const k = c ? c.join() : '';
        if (k !== hoverCell.current || c) onHover(c, e.clientX, e.clientY);
        hoverCell.current = k;
      }
      return;
    }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (ptrs.current.size === 2 && d.pinch) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / d.pinch);
      d.pinch = dist;
      return;
    }
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.x = e.clientX;
    d.y = e.clientY;
    if (selecting) {
      const [cx, cy] = cellAt(e.clientX, e.clientY);
      const [sx, sy] = d.cell;
      setSel({ x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx) + 1, h: Math.abs(cy - sy) + 1 });
    } else {
      if (d.moved > 6) onHover?.(null, 0, 0);
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
  };

  const up = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const d = drag.current;
    if (ptrs.current.size > 0 || !d) return;
    drag.current = null;
    if (d.moved < 6) inside(e.clientX, e.clientY) && onCell?.(...cellAt(e.clientX, e.clientY));
    else if (selecting && sel) onRect?.(sel);
    if (selecting) setSel(null);
  };

  const outline = (r: Rect, color: string, key?: number) => (
    <div
      key={key}
      className="pointer-events-none absolute"
      style={{ left: r.x, top: r.y, width: r.w, height: r.h, outline: `${2 / view.s}px solid ${color}`, background: `${color}22` }}
    />
  );

  const size = CANVAS * view.s;
  const minor = view.s * 10; // griglia ogni 10 pixel, visibile solo quando è abbastanza larga
  const grid = [
    `linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px)`,
    `linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)`,
    ...(minor >= 7 ? [`linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px)`, `linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)`] : []),
  ];
  const gridSize = [`${view.s * 100}px ${view.s * 100}px`, `${view.s * 100}px ${view.s * 100}px`, `${minor}px ${minor}px`, `${minor}px ${minor}px`];

  const btn = 'flex h-10 w-10 items-center justify-center text-lg font-bold text-white/80 transition hover:bg-white/10 hover:text-white';
  const zoomBtn = (f: number) => () => {
    const r = box.current!.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  };

  return (
    <div className={`${className} bg-[#05060b] bg-[radial-gradient(rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:22px_22px]`}>
      <div
        ref={box}
        className={`absolute inset-0 touch-none select-none ${selecting ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onHover?.(null, 0, 0)}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: view.tx, top: view.ty, width: size, height: size, boxShadow: '0 0 0 1px rgba(255,214,10,.35), 0 0 120px -10px rgba(255,214,10,.18)' }}
        />
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: CANVAS, height: CANVAS, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}>
          <canvas ref={cv} width={CANVAS} height={CANVAS} className="block" style={{ imageRendering: 'pixelated' }} />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: view.tx, top: view.ty, width: size, height: size, backgroundImage: grid.join(','), backgroundSize: gridSize.slice(0, grid.length).join(',') }}
        />
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: CANVAS, height: CANVAS, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}>
          {ghost && (
            <>
              {ghost.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ghost.src} alt="" className="absolute" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h, imageRendering: 'pixelated' }} />
              )}
              {outline(ghost, ghost.ok ? '#34d399' : '#ff4d6d')}
            </>
          )}
          {highlight.map((r, i) => outline(r, '#ffd60a', i))}
          {sel && outline(sel, '#3be8ff')}
        </div>
      </div>
      <div className={`glass absolute flex flex-col overflow-hidden rounded-2xl ${controlsClass}`}>
        <button type="button" aria-label="Ingrandisci" className={btn} onClick={zoomBtn(1.6)}>+</button>
        <button type="button" aria-label="Rimpicciolisci" className={`${btn} border-y border-white/10`} onClick={zoomBtn(1 / 1.6)}>−</button>
        <button type="button" aria-label="Mostra tutta la tela" title="Tutta la tela" className={btn} onClick={fit}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="fill-current"><path d="M3 3h7v3H6v4H3zM14 3h7v7h-3V6h-4zM3 14h3v4h4v3H3zM18 14h3v7h-7v-3h4z" /></svg>
        </button>
      </div>
    </div>
  );
}
