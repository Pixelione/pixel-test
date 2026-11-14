'use client';
import { useState } from 'react';
import { api } from '@/lib/browser';

export default function UsernameForm({ onDone, initial = '' }: { onDone: () => void; initial?: string }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api('/api/me', { method: 'POST', body: JSON.stringify({ username: name.trim() }) });
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm text-white/70" htmlFor="username">Nome visibile</label>
      <div className="flex gap-2">
        <input id="username" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. mario_rossi" maxLength={20} required />
        <button className="btn" disabled={busy}>Salva</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
