'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/browser';

// Accesso con link via email (Supabase). Il link riporta qui e la sessione si apre da sola.
export default function Accedi() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const next = () => {
    const n = new URLSearchParams(location.search).get('next');
    return n && n.startsWith('/') && !n.startsWith('//') ? n : '/profilo';
  };

  useEffect(() => {
    const go = (s: unknown) => s && location.replace(next());
    supabase.auth.getSession().then(({ data }) => go(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => go(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="card mx-auto mt-10 max-w-md space-y-4">
      <h1 className="text-xl font-bold">Accedi o crea l&apos;account</h1>
      {sent ? (
        <p>Ti abbiamo mandato un link a <b>{email}</b>. Aprilo da questo dispositivo per entrare. Non lo trovi? Guarda nello spam.</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const { error } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: { emailRedirectTo: `${location.origin}/accedi?next=${encodeURIComponent(next())}` },
            });
            setBusy(false);
            if (error) setError(error.status === 429 ? 'Troppe richieste: riprova tra qualche minuto.' : error.message);
            else setSent(true);
          }}
        >
          <label htmlFor="email" className="block text-sm text-white/70">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.it" />
          <button className="btn w-full" disabled={busy}>{busy ? 'Invio…' : 'Mandami il link'}</button>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <p className="text-xs text-white/45">Niente password. Usiamo l&apos;email solo per l&apos;accesso e le ricevute.</p>
        </form>
      )}
    </div>
  );
}
