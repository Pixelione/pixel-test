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

  if (logged === false)
    return (
      <div className="card mx-auto mt-10 max-w-md space-y-3 text-center">
        <h1 className="text-xl font-bold">Accedi per comprare</h1>
        <p className="text-white/65">Ti serve un account per ricevere i pixel, i bonus e vederli nel profilo.</p>
        <Link className="btn" href="/accedi?next=/compra">Accedi con la tua email</Link>
      </div>
    );
  if (!me) return <p className="mt-10 text-center text-white/60">{error || 'Caricamento…'}</p>;
  if (!me.profile.username)
    return (
      <div className="card mx-auto mt-10 max-w-md space-y-3">
        <h1 className="text-xl font-bold">Scegli il tuo nome</h1>
        <p className="text-white/65">Si vede quando qualcuno tocca i tuoi pixel e in classifica.</p>
        <UsernameForm onDone={loadMe} />
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Compra la tua area</h1>
        {me.credits > 0 && <p className="card py-2 text-sm">Hai <b className="text-gold">{me.credits}</b> pixel omaggio: si usano per primi.</p>}

        <section className="space-y-2">
          <h2 className="font-semibold">1. Carica l&apos;immagine</h2>
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-white/20 p-5 text-center hover:border-gold">
            <span className="font-medium">{img ? 'Cambia immagine' : 'Scegli un\'immagine'}</span>
            <span className="text-xs text-white/50">PNG, JPG, WebP o GIF. Viene ridotta qui sul tuo dispositivo.</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        </section>

        {nat && (
          <section className="space-y-3">
            <h2 className="font-semibold">2. Scegli quanti pixel</h2>
            <p className="text-sm text-white/65">
              La tua immagine è {nat.w}×{nat.h}. A piena qualità sulla tela occupa{' '}
              <b className="text-ink">{fullW}×{hOf(fullW)} = {fullPx.toLocaleString('it-IT')} pixel ({euro(fullPx * 100)})</b>
              {fullW < nat.w && ' (ridotta per entrare nella tela)'}. Più la restringi, meno paghi: l&apos;immagine resta la stessa, con meno dettagli.
            </p>
            <label className="block">
              <span className="sr-only">Larghezza in pixel</span>
              <input
                type="range"
                min={1}
                max={maxW}
                value={w}
                onChange={(e) => setW(Number(e.target.value))}
                className="w-full accent-[#ffd60a]"
                aria-valuetext={`${w} per ${h} pixel`}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-white/10 px-2 py-1 font-mono">{w}×{h}</span>
              <span className="font-mono">{pixels.toLocaleString('it-IT')} px</span>
              <span className="font-mono text-gold">{euro(pixels * 100)}</span>
              <span className={w > fullW ? 'text-amber-300' : 'text-white/60'}>
                {w > fullW ? 'Ingrandita: nessun dettaglio in più' : `Qualità ${Math.round((w / fullW) * 100)}%`}
              </span>
            </div>
            <div className="flex gap-1">
              {[0.1, 0.25, 0.5, 1].map((f) => (
                <button key={f} type="button" className="btn-ghost flex-1 px-2 py-1.5 text-xs" onClick={() => setW(Math.max(1, Math.round(fullW * f)))}>
                  {f === 1 ? 'Piena' : `${f * 100}%`}
                </button>
              ))}
            </div>
            {preview && (
              <div className="flex items-end gap-4">
                <figure className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Anteprima ingrandita" className="w-40 rounded bg-black" style={{ imageRendering: 'pixelated' }} />
                  <figcaption className="text-xs text-white/50">Ingrandita</figcaption>
                </figure>
                <figure className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Dimensione reale" style={{ width: Math.min(w, 160), imageRendering: 'pixelated' }} />
                  <figcaption className="text-xs text-white/50">Dimensione reale</figcaption>
                </figure>
              </div>
            )}
          </section>
        )}

        {nat && (
          <section className="space-y-3">
            <h2 className="font-semibold">3. Link e messaggio</h2>
            <input className="input" type="url" inputMode="url" placeholder="https://il-tuo-sito.it (facoltativo)" value={link} onChange={(e) => setLink(e.target.value)} />
            <div>
              <input className="input" maxLength={MESSAGE_MAX} placeholder="Messaggio (facoltativo)" value={message} onChange={(e) => setMessage(e.target.value)} />
              <p className="mt-1 text-right text-xs text-white/40">{message.length}/{MESSAGE_MAX}</p>
            </div>
          </section>
        )}

        {nat && sum && (
          <section className="card space-y-1.5 text-sm">
            <Row l={`${pixels} pixel`} r={euro(pixels * 100)} />
            {sum.credits > 0 && <Row l={`Pixel omaggio usati (${sum.credits})`} r={`− ${euro(sum.credits * 100)}`} />}
            {sum.fee > 0 && <Row l="Commissione di pagamento" r={euro(sum.fee)} />}
            <div className="border-t border-white/10 pt-1.5"><Row l={<b>Totale</b>} r={<b>{euro(sum.total)}</b>} /></div>
            {sum.bonus + sum.early > 0 && (
              <p className="text-gold">
                Ricevi {sum.bonus + sum.early} pixel omaggio da usare al prossimo acquisto
                {sum.early ? ' (incluso 1 per esserti iscritto prima del lancio)' : ''}.
              </p>
            )}
            {sum.paid > 0 && sum.paid < BONUS_EVERY && <p className="text-white/50">Ogni {BONUS_EVERY} pixel pagati ne ricevi 1 in omaggio.</p>}
            <label className="flex items-start gap-2 pt-2">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 accent-[#ffd60a]" />
              <span>Accetto i <a href="/termini" target="_blank" className="underline">Termini</a> e la <a href="/privacy" target="_blank" className="underline">Privacy</a>. Niente odio, contenuti per adulti o marchi altrui: l&apos;area può essere rimossa.</span>
            </label>
            {error && <p role="alert" className="text-red-400">{error}</p>}
            <button type="button" className="btn mt-2 w-full" disabled={!ghost || !free || !accept || busy} onClick={buy}>
              {busy ? 'Un attimo…' : !ghost ? 'Tocca la tela per posizionarla' : !free ? 'Posizione occupata' : sum.total > 0 ? `Paga ${euro(sum.total)}` : 'Conferma con i pixel omaggio'}
            </button>
          </section>
        )}
        {!nat && error && <p role="alert" className="text-red-400">{error}</p>}
      </div>

      <div className="space-y-2 lg:sticky lg:top-16 lg:self-start">
        <h2 className="font-semibold">4. Posizionala sulla tela</h2>
        <CanvasView
          areas={areas}
          ghost={ghost ? { ...ghost, src: preview, ok: free } : null}
          onCell={(x, y) => w && setPos({ x: Math.max(0, Math.min(CANVAS - w, x - Math.floor(w / 2))), y: Math.max(0, Math.min(CANVAS - h, y - Math.floor(h / 2))) })}
          height="min(75vh, 720px)"
        />
        <p className="text-sm text-white/50">
          {ghost ? `Posizione ${ghost.x},${ghost.y}. ${free ? 'Libera.' : 'Si sovrappone a un\'area già venduta: spostala.'}` : 'Carica un\'immagine, poi tocca il punto dove la vuoi.'}
        </p>
      </div>
    </div>
  );
}

const Row = ({ l, r }: { l: React.ReactNode; r: React.ReactNode }) => (
  <div className="flex justify-between gap-4"><span className="text-white/70">{l}</span><span className="font-mono">{r}</span></div>
);
