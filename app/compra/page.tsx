'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CanvasView from '@/components/CanvasView';
import UsernameForm from '@/components/UsernameForm';
import { api, supabase } from '@/lib/browser';
import { BONUS_EVERY, CANVAS, MESSAGE_MAX, euro, estimate, overlaps, type Area } from '@/lib/config';

type Me = {
  profile: { username: string | null; early_bird: boolean };
  credits: number;
  fee: { percent: number; fixedCents: number };
  orders: { status: string; paid_pixels: number }[];
};

// Riduce l'immagine a w x h dimezzando a passi: meno scalettature di un ridimensionamento unico.
function shrink(img: HTMLImageElement, w: number, h: number) {
  let src: CanvasImageSource = img, sw = img.naturalWidth, sh = img.naturalHeight;
  while (sw / 2 >= w && sh / 2 >= h) {
    const c = document.createElement('canvas');
    c.width = Math.round(sw / 2);
    c.height = Math.round(sh / 2);
    const x = c.getContext('2d')!;
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const x = out.getContext('2d')!;
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, 0, 0, w, h);
  return out.toDataURL('image/png');
}

export default function Compra() {
  const [logged, setLogged] = useState<boolean | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [w, setW] = useState(0);
  const [preview, setPreview] = useState('');
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadMe = () => api<Me>('/api/me').then(setMe).catch((e) => setError(e.message));
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLogged(!!data.session);
      if (data.session) loadMe();
    });
    fetch('/api/areas').then((r) => r.json()).then(setAreas).catch(() => {});
  }, []);

  const nat = img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
  const maxW = nat ? Math.max(1, Math.min(CANVAS, Math.floor((CANVAS * nat.w) / nat.h))) : 1;
  const fullW = nat ? Math.min(nat.w, maxW) : 1; // larghezza a piena qualità che entra nella tela
  const hOf = (ww: number) => (nat ? Math.max(1, Math.min(CANVAS, Math.round((ww * nat.h) / nat.w))) : 1);
  const h = hOf(w);
  const fullPx = nat ? Math.min(nat.w, fullW) * hOf(fullW) : 0;

  useEffect(() => {
    if (img && w > 0) setPreview(shrink(img, w, h));
  }, [img, w, h]);

  const pick = (file?: File) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Scegli un file immagine (PNG, JPG, WebP, GIF).');
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      const fit = Math.max(1, Math.min(CANVAS, Math.floor((CANVAS * im.naturalWidth) / im.naturalHeight)));
      setW(Math.min(im.naturalWidth, fit, 100)); // partenza: al massimo 100 pixel di larghezza
      setPos(null);
    };
    im.onerror = () => setError('Immagine non leggibile.');
    im.src = url;
  };

  const ghost = pos && w ? { x: Math.min(pos.x, CANVAS - w), y: Math.min(pos.y, CANVAS - h), w, h } : null;
  const free = !!ghost && !areas.some((a) => overlaps(a, ghost));

  const pixels = w * h;
  const sum = useMemo(() => {
    if (!me) return null;
    const credits = Math.min(Math.max(me.credits, 0), pixels);
    const paid = pixels - credits;
    const first = !me.orders.some((o) => (o.status === 'paid' || o.status === 'refunded') && o.paid_pixels > 0);
    const early = me.profile.early_bird && first && paid >= 5 ? 1 : 0;
    return { credits, paid, bonus: Math.floor(paid / BONUS_EVERY), early, ...estimate(paid, me.fee.percent, me.fee.fixedCents) };
  }, [me, pixels]);

  const buy = async () => {
    if (!ghost || !free || !preview) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ url: string }>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ ...ghost, image: preview, link: link.trim(), message, accept }),
      });
      location.href = r.url;
    } catch (e) {
      setError((e as Error).message);
      fetch('/api/areas').then((r) => r.json()).then(setAreas).catch(() => {});
      setBusy(false);
    }
  };

  const fill = maxW > 1 ? ((w - 1) / (maxW - 1)) * 100 : 100;
  const desktop = typeof window !== 'undefined' && matchMedia('(min-width: 1024px)').matches; // letto solo al primo adattamento

  let body: React.ReactNode;
  if (logged === false)
    body = (
      <div className="space-y-3 py-6 text-center">
        <h1 className="text-2xl font-bold">Accedi per comprare</h1>
        <p className="text-white/65">Ti serve un account per ricevere i pixel, i bonus e vederli nel profilo.</p>
        <Link className="btn w-full" href="/accedi?next=/compra">Accedi con la tua email</Link>
      </div>
    );
  else if (!me) body = <p className="py-10 text-center text-white/60">{error || 'Caricamento…'}</p>;
  else if (!me.profile.username)
    body = (
      <div className="space-y-3 py-4">
        <h1 className="text-2xl font-bold">Scegli il tuo nome</h1>
        <p className="text-white/65">Si vede quando qualcuno tocca i tuoi pixel e in classifica.</p>
        <UsernameForm onDone={loadMe} />
      </div>
    );
  else
    body = (
      <div className="space-y-6">
        <div>
          <p className="label">Nuova area</p>
          <h1 className="mt-1 text-2xl font-bold">Compra i tuoi pixel</h1>
          {me.credits > 0 && <p className="mt-2 inline-flex rounded-full bg-gold/10 px-3 py-1 text-sm text-gold">Hai {me.credits} pixel omaggio: si usano per primi</p>}
        </div>

        <Step n={1} title="Carica l'immagine" done={!!img}>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
            className={`group flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition hover:border-gold hover:bg-gold/[.04] ${img ? 'border-white/10' : 'border-white/20'}`}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-black object-contain" style={{ imageRendering: 'pixelated' }} />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 group-hover:text-gold">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden className="fill-current"><path d="M10 14h4V8h4l-6-6-6 6h4zM3 16h3v3h12v-3h3v6H3z" /></svg>
              </span>
            )}
            <span className="min-w-0">
              <span className="block font-semibold">{img ? 'Cambia immagine' : 'Scegli o trascina un\'immagine'}</span>
              <span className="block text-xs text-white/50">{nat ? `${nat.w}×${nat.h} originale` : 'PNG, JPG, WebP o GIF. Viene ridotta sul tuo dispositivo.'}</span>
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        </Step>

        {nat && (
          <Step n={2} title="Scegli la dimensione" done>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-3xl font-bold tracking-tight">{w}<span className="text-white/35">×</span>{h}</span>
              <span className="font-mono text-xl font-bold text-gold">{euro(pixels * 100)}</span>
            </div>
            <label className="block">
              <span className="sr-only">Larghezza in pixel</span>
              <input
                type="range"
                min={1}
                max={maxW}
                value={w}
                onChange={(e) => setW(Number(e.target.value))}
                className="slider w-full"
                style={{ '--fill': `${fill}%` } as React.CSSProperties}
                aria-valuetext={`${w} per ${h} pixel`}
              />
            </label>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-white/55">{pixels.toLocaleString('it-IT')} pixel</span>
              <span className={w > fullW ? 'text-amber-300' : 'text-white/55'}>
                {w > fullW ? 'Ingrandita: nessun dettaglio in più' : `Qualità ${Math.round((w / fullW) * 100)}%`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/30 p-1">
              {[0.1, 0.25, 0.5, 1].map((f) => {
                const v = Math.max(1, Math.round(fullW * f));
                return (
                  <button key={f} type="button" onClick={() => setW(v)} className={`rounded-lg py-1.5 text-xs font-medium transition ${w === v ? 'bg-white text-bg' : 'text-white/65 hover:bg-white/10'}`}>
                    {f === 1 ? 'Piena' : `${f * 100}%`}
                  </button>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed text-white/50">
              A piena qualità occupa <b className="text-white/80">{fullW}×{hOf(fullW)} = {fullPx.toLocaleString('it-IT')} px ({euro(fullPx * 100)})</b>
              {fullW < nat.w && ', ridotta per entrare nella tela'}. Più la restringi, meno paghi: stessa immagine, meno dettagli.
            </p>
            {preview && (
              <div className="flex items-end gap-4 rounded-2xl bg-black/30 p-3">
                <figure className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Anteprima ingrandita" className="w-32 rounded-lg" style={{ imageRendering: 'pixelated' }} />
                  <figcaption className="label text-[10px]">Ingrandita</figcaption>
                </figure>
                <figure className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Dimensione reale" style={{ width: Math.min(w, 128), imageRendering: 'pixelated' }} />
                  <figcaption className="label text-[10px]">Reale</figcaption>
                </figure>
              </div>
            )}
          </Step>
        )}

        {nat && (
          <Step n={3} title="Posizionala sulla tela" done={!!ghost && free}>
            <p className={`rounded-xl px-3 py-2 text-sm ${!ghost ? 'bg-white/5 text-white/65' : free ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>
              {!ghost ? 'Tocca un punto libero della tela.' : free ? `Posizione ${ghost.x}, ${ghost.y}: libera.` : 'Si sovrappone a un\'area già venduta: spostala.'}
            </p>
          </Step>
        )}

        {nat && (
          <Step n={4} title="Link e messaggio" done={!!link}>
            <input className="input" type="url" inputMode="url" placeholder="https://il-tuo-sito.it (facoltativo)" value={link} onChange={(e) => setLink(e.target.value)} />
            <div>
              <input className="input" maxLength={MESSAGE_MAX} placeholder="Messaggio (facoltativo)" value={message} onChange={(e) => setMessage(e.target.value)} />
              <p className="mt-1 text-right font-mono text-[11px] text-white/35">{message.length}/{MESSAGE_MAX}</p>
            </div>
          </Step>
        )}

        {nat && sum && (
          <section className="space-y-1.5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
            <Row l={`${pixels.toLocaleString('it-IT')} pixel`} r={euro(pixels * 100)} />
            {sum.credits > 0 && <Row l={`Pixel omaggio usati (${sum.credits})`} r={`− ${euro(sum.credits * 100)}`} />}
            {sum.fee > 0 && <Row l="Commissione di pagamento" r={euro(sum.fee)} />}
            <div className="mt-1 border-t border-white/10 pt-2"><Row l={<b className="text-ink">Totale</b>} r={<b className="text-lg text-ink">{euro(sum.total)}</b>} /></div>
            {sum.bonus + sum.early > 0 && (
              <p className="pt-1 text-gold">
                + {sum.bonus + sum.early} pixel omaggio per il prossimo acquisto
                {sum.early ? ' (incluso 1 per esserti iscritto prima del lancio)' : ''}
              </p>
            )}
            {sum.paid > 0 && sum.paid < BONUS_EVERY && <p className="pt-1 text-white/50">Ogni {BONUS_EVERY} pixel pagati ne ricevi 1 in omaggio.</p>}
          </section>
        )}

        {nat && sum && (
          <div className="sticky bottom-0 -mx-5 space-y-3 border-t border-white/10 bg-[#0d0f1a]/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
            <label className="flex items-start gap-2.5 text-xs text-white/65">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#ffd60a]" />
              <span>Accetto i <a href="/termini" target="_blank" className="underline">Termini</a> e la <a href="/privacy" target="_blank" className="underline">Privacy</a>. Niente odio, contenuti per adulti o marchi altrui: l&apos;area può essere rimossa.</span>
            </label>
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
            <button type="button" className="btn h-12 w-full text-base" disabled={!ghost || !free || !accept || busy} onClick={buy}>
              {busy ? 'Un attimo…' : !ghost ? 'Tocca la tela per posizionarla' : !free ? 'Posizione occupata' : !accept ? 'Accetta i termini' : sum.total > 0 ? `Paga ${euro(sum.total)}` : 'Conferma con i pixel omaggio'}
            </button>
          </div>
        )}
        {!nat && error && <p role="alert" className="text-sm text-bad">{error}</p>}
        {!nat && <div className="h-5" />}
      </div>
    );

  return (
    <div className="fixed inset-0 overflow-hidden">
      <CanvasView
        className="absolute inset-x-0 top-0 h-[46dvh] overflow-hidden lg:h-full"
        pad={desktop ? [76, 24, 24, 460] : [64, 12, 12, 12]}
        controlsClass="right-3 bottom-3 lg:right-4 lg:bottom-4"
        areas={areas}
        ghost={ghost ? { ...ghost, src: preview, ok: free } : null}
        onCell={(x, y) => w && setPos({ x: Math.max(0, Math.min(CANVAS - w, x - Math.floor(w / 2))), y: Math.max(0, Math.min(CANVAS - h, y - Math.floor(h / 2))) })}
      />
      <aside className="glass absolute inset-x-0 bottom-0 [scrollbar-color:rgba(255,255,255,.15)_transparent] [scrollbar-width:thin] top-[46dvh] overflow-y-auto rounded-t-3xl border-b-0 px-5 pt-5 lg:bottom-4 lg:left-4 lg:right-auto lg:top-[76px] lg:w-[420px] lg:rounded-3xl lg:border-b">
        {body}
      </aside>
    </div>
  );
}

const Step = ({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="flex items-center gap-2.5 font-semibold">
      <span className={`flex h-6 w-6 items-center justify-center rounded-md font-pixel text-[11px] ${done ? 'bg-gold text-bg' : 'bg-white/10 text-white/70'}`}>{n}</span>
      {title}
    </h2>
    {children}
  </section>
);

const Row = ({ l, r }: { l: React.ReactNode; r: React.ReactNode }) => (
  <div className="flex justify-between gap-4"><span className="text-white/60">{l}</span><span className="font-mono">{r}</span></div>
);
