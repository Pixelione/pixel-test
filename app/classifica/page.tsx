'use client';
import { useEffect, useState } from 'react';

type Row = { rank: number; username: string; paid_pixels: number; owned_pixels: number };
const TABS = [['day', 'Oggi'], ['week', 'Settimana'], ['all', 'Sempre']] as const;

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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Classifica</h1>
        <p className="text-sm text-white/55">Per pixel pagati: gli omaggi non contano. Giorno e settimana (da lunedì) secondo l&apos;ora italiana.</p>
      </div>
      <div role="tablist" className="flex gap-1 rounded-lg bg-white/5 p-1">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={period === k}
            type="button"
            onClick={() => setPeriod(k)}
            className={`flex-1 rounded-md py-2 text-sm font-medium ${period === k ? 'bg-gold text-bg' : 'text-white/70'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {!rows ? (
        <p className="text-white/50">Caricamento…</p>
      ) : rows.length === 0 ? (
        <p className="card text-white/60">Nessun acquisto in questo periodo. Il primo posto è libero.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.username} className={`card flex items-center gap-3 py-2.5 ${r.rank === 1 ? 'border-gold/60' : ''}`}>
              <span className={`w-8 font-mono font-bold ${r.rank <= 3 ? 'text-gold' : 'text-white/50'}`}>{r.rank}</span>
              <span className="flex-1 truncate font-medium">{r.username}</span>
              <span className="font-mono text-sm">{Number(r.paid_pixels).toLocaleString('it-IT')} px</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
