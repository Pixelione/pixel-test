'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/browser';

const LINKS = [
  ['/', 'Tela'],
  ['/compra', 'Compra'],
  ['/classifica', 'Classifica'],
];

export default function Nav() {
  const path = usePathname();
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    // Link di invito: ?ref=CODICE resta salvato finché non crei l'account.
    try {
      const ref = new URLSearchParams(location.search).get('ref');
      if (ref && /^[a-f0-9]{8}$/.test(ref)) localStorage.setItem('ref', ref);
    } catch {}
    supabase.auth.getSession().then(({ data }) => setLogged(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setLogged(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  const item = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium ${path === href ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white'}`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-bg/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-2">
        <Link href="/" className="mr-auto flex items-center gap-2 font-mono text-sm font-bold tracking-widest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={28} height={28} className="rounded" />
          <span className="hidden sm:inline">PIXELIONE</span>
        </Link>
        {LINKS.map(([h, l]) => item(h, l))}
        {item(logged ? '/profilo' : '/accedi', logged ? 'Profilo' : 'Accedi')}
      </nav>
    </header>
  );
}
