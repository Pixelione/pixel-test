import type { Metadata } from 'next';
import Link from 'next/link';
import { db, imageUrl } from '@/lib/server';

export const dynamic = 'force-dynamic';

type Detail = {
  id: number; x: number; y: number; w: number; h: number; image_path: string;
  link: string | null; message: string | null; username: string;
  owner_pixels: number; owner_areas: number; rank: number | null; clicks: number;
};

async function load(id: number): Promise<Detail | null> {
  if (!Number.isInteger(id)) return null;
  const { data } = await db.rpc('area_detail', { p_id: id });
  return data?.[0] ?? null;
}

const n = (v: number) => Number(v).toLocaleString('it-IT');

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const a = await load(Number((await params).id));
  if (!a) return { title: 'Area — PIXELIONE' };
  const title = `${a.username} su PIXELIONE`;
  const description = `${a.w}×${a.h} pixel${a.message ? ` · ${a.message}` : ''}. Prenditi anche tu un pezzo di tela.`;
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

// Pagina condivisibile di una singola area: anteprima social propria (opengraph-image.tsx qui accanto).
export default async function AreaPage({ params }: { params: Promise<{ id: string }> }) {
  const a = await load(Number((await params).id));
  if (!a)
    return (
      <div className="relative min-h-dvh">
        <main className="mx-auto max-w-md px-4 pt-28 text-center">
          <p className="text-white/70">Quest&apos;area non esiste più.</p>
          <Link href="/" className="btn mt-4">Vai alla tela</Link>
        </main>
      </div>
    );

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,214,10,.10),transparent)]" />
      <main className="mx-auto max-w-md px-4 pb-16 pt-24">
        <div className="glass rounded-3xl p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(a.image_path)} alt="" className="mx-auto max-h-64 w-auto rounded-xl border border-white/10 bg-black" style={{ aspectRatio: `${a.w} / ${a.h}` }} />
          <div className="mt-4 flex items-center gap-2">
            <h1 className="text-xl font-bold">{a.username}</h1>
            {a.rank != null && <span className="rounded-full bg-gold/15 px-2 py-0.5 font-pixel text-[10px] text-gold">#{a.rank}</span>}
          </div>
          <p className="mt-1 font-mono text-xs text-white/50">{a.w}×{a.h} = {n(a.w * a.h)} px · posizione {a.x}, {a.y} · {n(a.clicks)} click</p>
          {a.message && <p className="mt-2 text-white/85">{a.message}</p>}
          <div className="mt-4 flex gap-2">
            {a.link && (
              <a href={`/r/${a.id}`} target="_blank" rel="sponsored noopener noreferrer" className="btn flex-1">Visita il sito</a>
            )}
            <Link href={`/?area=${a.id}`} className={a.link ? 'btn-ghost flex-1' : 'btn w-full'}>Vedi sulla tela</Link>
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-white/60">
          Un milione di pixel, 1 € l&apos;uno. <Link href="/compra" className="text-gold underline">Prendi il tuo</Link>.
        </p>
      </main>
    </div>
  );
}
