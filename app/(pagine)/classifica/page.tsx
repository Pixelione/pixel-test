'use client';
import { useEffect, useState } from 'react';

type Row = { rank: number; username: string; paid_pixels: number; owned_pixels: number };
const TABS = [['day', 'Oggi'], ['week', 'Settimana'], ['all', 'Sempre']] as const;
const MEDAL = ['#ffd60a', '#d7dbe8', '#e69a5b'];
const n = (v: number) => Number(v).toLocaleString('it-IT');

export default function Classifica() {
  const [period, setPeriod] = useState<(typeof TABS)[number][0]>('all');
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    setRows(null);
    fetch(`/api/leaderboard?period=${period}`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  }, [period]);

  const top = rows?.slice(0, 3) ?? [];
  // Podio: secondo, primo, terzo.
  const podium = [top[1], top[0], top[2]];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <p className="label">Classifica</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Chi possiede più tela</h1>
        <p className="mt-2 text-sm text-white/55">Per pixel pagati: gli omaggi non contano. Giorno e settimana (da lunedì) secondo l&apos;ora italiana.</p>
      </div>
      <div role="tablist" className="mx-auto grid max-w-sm grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/[.03] p-1">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={period === k}
            type="button"
            onClick={() => setPeriod(k)}
            className={`rounded-full py-2 text-sm font-medium transition ${period === k ? 'bg-gold text-bg' : 'text-white/65 hover:text-white'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {!rows ? (
        <p className="text-center text-white/50">Caricamento…</p>
      ) : rows.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="font-pixel text-gold">#1 LIBERO</p>
          <p className="mt-2 text-white/60">Nessun acquisto in questo periodo. Il primo posto è libero.</p>
        </div>
      ) : (
        <>
          <ol className="grid grid-cols-3 items-end gap-2 sm:gap-3">
            {podium.map((r, i) =>
              r ? (
                <li key={r.username} className="flex min-w-0 flex-col items-center gap-2">
                  <span className="max-w-full truncate px-1 text-sm font-semibold">{r.username}</span>
                  <span className="font-mono text-xs text-white/55">{n(r.paid_pixels)} px</span>
                  <div
                    className="flex w-full items-start justify-center rounded-t-2xl border border-b-0 pt-3 font-pixel text-2xl"
                    style={{ height: [96, 132, 72][i], color: MEDAL[r.rank - 1], borderColor: `${MEDAL[r.rank - 1]}55`, background: `linear-gradient(${MEDAL[r.rank - 1]}22, transparent)` }}
                  >
                    {r.rank}
                  </div>
                </li>
              ) : (
                <li key={i} />
              ),
            )}
          </ol>
          {rows.length > 3 && (
            <ol className="space-y-1.5">
              {rows.slice(3).map((r) => (
                <li key={r.username} className="card flex items-center gap-3 py-2.5">
                  <span className="w-8 font-mono font-bold text-white/45">{r.rank}</span>
                  <span className="flex-1 truncate font-medium">{r.username}</span>
                  <span className="font-mono text-sm">{n(r.paid_pixels)} px</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
