'use client';
import { useEffect, useRef, useState } from 'react';
import { CANVAS, type Area } from '@/lib/config';

type Rect = { x: number; y: number; w: number; h: number };
type Props = {
  areas: Area[];
  ghost?: (Rect & { src?: string; ok: boolean }) | null; // area in acquisto
  highlight?: Rect[]; // aree selezionate (admin)
  selecting?: boolean; // trascina per disegnare un rettangolo invece di spostare la tela
  onCell?: (x: number, y: number) => void;
  onRect?: (r: Rect) => void;
  height?: string;
};

// Tela 1000x1000: un pixel di tela = un pixel dell'immagine. Zoom con rotella, pizzico o pulsanti; trascina per spostare.
export default function CanvasView({ areas, ghost, highlight = [], selecting, onCell, onRect, height = '70vh' }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const [sel, setSel] = useState<Rect | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; moved: number; cell: [number, number]; pinch?: number } | null>(null);

  // Adatta la tela al contenitore all'avvio.
  useEffect(() => {
    const el = box.current!;
    const s = Math.min(el.clientWidth, el.clientHeight) / CANVAS;
    setView({ s, tx: (el.clientWidth - CANVAS * s) / 2, ty: (el.clientHeight - CANVAS * s) / 2 });
  }, []);

  // Disegna le aree vendute sopra la griglia.
  useEffect(() => {
    const ctx = cv.current!.getContext('2d')!;
    ctx.fillStyle = '#0d0f1a';
    ctx.fillRect(0, 0, CANVAS, CANVAS);
    ctx.fillStyle = '#181c2e';
    for (let i = 0; i < CANVAS; i += 10) for (let j = (i / 10) % 2 ? 10 : 0; j < CANVAS; j += 20) ctx.fillRect(i, j, 10, 10);
    let alive = true;
    for (const a of areas) {
      const img = new Image();
      img.onload = () => alive && ctx.drawImage(img, a.x, a.y, a.w, a.h);
      img.src = a.image_url;
    }
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

  const zoomAt = (cx: number, cy: number, f: number) =>
    setView((v) => {
      const r = box.current!.getBoundingClientRect();
      const s = Math.max(0.2, Math.min(40, v.s * f));
      const px = cx - r.left, py = cy - r.top;
      return { s, tx: px - ((px - v.tx) * s) / v.s, ty: py - ((py - v.ty) * s) / v.s };
    });

  useEffect(() => {
    const el = box.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
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
    if (!ptrs.current.has(e.pointerId) || !drag.current) return;
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
    } else setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  };

  const up = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const d = drag.current;
    if (ptrs.current.size > 0 || !d) return;
    drag.current = null;
    if (d.moved < 6) onCell?.(...cellAt(e.clientX, e.clientY));
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

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#07080f]" style={{ height }}>
      <div
        ref={box}
        className={`absolute inset-0 touch-none select-none ${selecting ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: CANVAS, height: CANVAS, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}>
          <canvas ref={cv} width={CANVAS} height={CANVAS} className="block" style={{ imageRendering: 'pixelated' }} />
          {ghost && (
            <>
              {ghost.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ghost.src} alt="" className="pointer-events-none absolute" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h, imageRendering: 'pixelated' }} />
              )}
              {outline(ghost, ghost.ok ? '#22c55e' : '#ef4444')}
            </>
          )}
          {highlight.map((r, i) => outline(r, '#ffd60a', i))}
          {sel && outline(sel, '#38bdf8')}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 flex gap-2">
        {[['−', 1 / 1.5], ['+', 1.5]].map(([l, f]) => (
          <button
            key={l as string}
            type="button"
            aria-label={l === '+' ? 'Ingrandisci' : 'Rimpicciolisci'}
            onClick={() => {
              const r = box.current!.getBoundingClientRect();
              zoomAt(r.left + r.width / 2, r.top + r.height / 2, f as number);
            }}
            className="h-10 w-10 rounded-lg bg-white/10 text-xl font-bold text-white backdrop-blur hover:bg-white/20"
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
