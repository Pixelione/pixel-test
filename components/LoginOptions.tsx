'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/browser';

// Accesso: Google con un tocco, oppure link via email (più codice, se il modello email lo include: serve SMTP proprio).
export default function LoginOptions({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [hasGoogle, setHasGoogle] = useState(false);
  // Il pulsante Google compare solo se il provider è attivo in Supabase.
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } })
      .then((r) => r.json())
      .then((s) => setHasGoogle(!!s.external?.google))
      .catch(() => {});
  }, []);
  const back = () => `${location.origin}/accedi?next=${encodeURIComponent(next)}`;

  const google = async () => {
    setBusy('google');
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back() } });
    if (error) {
      setError(/not enabled|Unsupported provider/i.test(error.message) ? 'Accesso con Google non ancora attivo: usa l\'email.' : error.message);
      setBusy('');
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('email');
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: back() } });
    setBusy('');
    if (error) setError(error.status === 429 ? 'Troppe richieste: riprova tra qualche minuto.' : error.message);
    else setSent(true);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('code');
    setError('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy('');
    if (error) setError('Codice sbagliato o scaduto. Controlla l\'ultima email o richiedine uno nuovo.');
    // Se va bene, onAuthStateChange nella pagina porta avanti.
  };

  return (
    <div className="space-y-4">
      {!sent && (
        <>
          {hasGoogle && (<>
          <button
            type="button"
            onClick={google}
            disabled={!!busy}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white font-semibold text-[#1f1f1f] transition hover:bg-white/90 disabled:opacity-60"
          >
            <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {busy === 'google' ? 'Apro Google…' : 'Continua con Google'}
          </button>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="h-px flex-1 bg-white/10" />oppure con l&apos;email<span className="h-px flex-1 bg-white/10" />
          </div>
          </>)}
          <form className="space-y-3" onSubmit={send}>
            <label htmlFor="email" className="sr-only">Email</label>
            <input id="email" type="email" autoComplete="email" required className="input h-12" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.it" />
            <button className={`${hasGoogle ? 'btn-ghost' : 'btn'} h-12 w-full`} disabled={!!busy}>{busy === 'email' ? 'Invio…' : 'Mandami il link di accesso'}</button>
          </form>
        </>
      )}
      {sent && (
        <form className="space-y-3" onSubmit={verify}>
          <p className="text-sm text-white/70">Ti abbiamo scritto a <b className="text-ink">{email}</b>. Tocca il link nell&apos;email per entrare. Se l&apos;email contiene un codice, puoi scriverlo qui.</p>
          <label htmlFor="code" className="sr-only">Codice</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            required
            autoFocus
            className="input h-14 text-center font-mono text-2xl tracking-[.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="••••••"
          />
          <button className="btn h-12 w-full" disabled={!!busy || code.length < 6}>{busy === 'code' ? 'Controllo…' : 'Entra'}</button>
          <button type="button" className="w-full text-sm text-white/50 underline hover:text-white" onClick={() => { setSent(false); setCode(''); setError(''); }}>
            Cambia email o rimanda il codice
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <p className="text-xs text-white/40">Niente password. Usiamo l&apos;email solo per l&apos;accesso e le ricevute.</p>
    </div>
  );
}
