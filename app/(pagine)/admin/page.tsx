'use client';
import { useEffect, useState } from 'react';
import CanvasView from '@/components/CanvasView';
import { api } from '@/lib/browser';
import type { Area } from '@/lib/config';

type AdminArea = Area & { email: string; owner: string; created_at: string };
type User = { id: string; username: string | null; email: string; credits: number };

// Cancella aree (per account o con un rettangolo sulla tela) e riaccredita i pixel ai proprietari.
export default function Admin() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [found, setFound] = useState<AdminArea[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [denied, setDenied] = useState(false);

  const loadCanvas = () => fetch('/api/areas').then((r) => r.json()).then(setAreas).catch(() => {});
  useEffect(() => {
    loadCanvas();
    api('/api/admin?x=0&y=0&w=1&h=1').catch((e) => e.message === 'Solo admin' || /Accedi/.test(e.message) ? setDenied(true) : null);
  }, []);

  const show = (r: { users: User[]; areas: AdminArea[] }) => {
    setUsers(r.users);
    setFound(r.areas);
    setPicked(new Set(r.areas.map((a) => a.id)));
    setConfirm(false);
  };
  const search = (params: string) => api(`/api/admin?${params}`).then(show).catch((e) => setMsg(e.message));

  const remove = async () => {
    const ids = [...picked];
    try {
      const r = await api<{ removed: number }>('/api/admin', { method: 'POST', body: JSON.stringify({ ids, reason }) });
      setMsg(`Cancellate: ${r.removed}. I pixel sono tornati ai proprietari come omaggio.`);
      setFound((f) => f.filter((a) => !picked.has(a.id)));
      setPicked(new Set());
      setConfirm(false);
      loadCanvas();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  if (denied) return <p className="mt-10 text-center text-white/60">Pagina riservata all&apos;amministratore.</p>;
  const px = found.filter((a) => picked.has(a.id)).reduce((n, a) => n + a.w * a.h, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) search(`q=${encodeURIComponent(q.trim())}`); }}>
          <input className="input" placeholder="Nome o email dell'account" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn">Cerca</button>
        </form>
        <button type="button" className={selecting ? 'btn w-full' : 'btn-ghost w-full'} onClick={() => setSelecting((s) => !s)}>
          {selecting ? 'Trascina un rettangolo sulla tela…' : 'Seleziona con un rettangolo sulla tela'}
        </button>

        {users.length > 0 && (
          <ul className="space-y-1 text-sm">
            {users.map((u) => (
              <li key={u.id} className="card py-2">
                <b>{u.username ?? '—'}</b> · {u.email} · <span className="text-gold">{u.credits} omaggio</span>
              </li>
            ))}
          </ul>
        )}

        {found.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{picked.size} di {found.length} selezionate · {px} px</span>
              <span className="flex gap-3">
                <button type="button" className="underline" onClick={() => setPicked(new Set(found.map((a) => a.id)))}>Tutte</button>
                <button type="button" className="underline" onClick={() => setPicked(new Set())}>Nessuna</button>
              </span>
            </div>
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
              {found.map((a) => (
                <li key={a.id}>
                  <label className="card flex cursor-pointer items-center gap-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-[#ffd60a]"
                      checked={picked.has(a.id)}
                      onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(a.id); else n.delete(a.id); return n; })}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.image_url} alt="" className="h-10 w-10 rounded bg-black object-contain" style={{ imageRendering: 'pixelated' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate"><b>{a.username ?? '—'}</b> · {a.email}</span>
                      <span className="block font-mono text-xs text-white/50">#{a.id} · {a.w}×{a.h} · {a.x},{a.y}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <input className="input" placeholder="Motivo (facoltativo)" value={reason} onChange={(e) => setReason(e.target.value)} />
            {!confirm ? (
              <button type="button" className="btn w-full bg-red-500 text-white" disabled={!picked.size} onClick={() => setConfirm(true)}>
                Cancella {picked.size} {picked.size === 1 ? 'area' : 'aree'} e riaccredita {px} pixel
              </button>
            ) : (
              <div className="card space-y-2 border-red-500/60">
                <p className="text-sm">Le aree spariscono dalla tela subito e non si possono ripristinare. I proprietari ricevono {px} pixel omaggio.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn flex-1 bg-red-500 text-white" onClick={remove}>Sì, cancella</button>
                  <button type="button" className="btn-ghost flex-1" onClick={() => setConfirm(false)}>Annulla</button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <p className="text-sm text-white/50">Cerca un account o seleziona una zona: le aree trovate compaiono qui.</p>
        )}
        {msg && <p role="status" className="text-sm text-gold">{msg}</p>}
      </div>

      <CanvasView
        areas={areas}
        selecting={selecting}
        highlight={found.filter((a) => picked.has(a.id))}
        onRect={(r) => { setSelecting(false); search(`x=${r.x}&y=${r.y}&w=${r.w}&h=${r.h}`); }}
        onCell={(x, y) => search(`x=${x}&y=${y}&w=1&h=1`)}
        className="relative h-[min(80vh,760px)] overflow-hidden rounded-2xl border border-white/10 lg:sticky lg:top-20"
      />
    </div>
  );
}
