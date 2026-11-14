'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/browser';

// Icone 24x24 disegnate a quadretti, in tema con la tela.
const ICON: Record<string, string> = {
  tela: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  classifica: 'M3 14h5v7H3zM9.5 8h5v13h-5zM16 11h5v10h-5z',
  profilo: 'M8 3h8v8H8zM4 14h16v7H4z',
};
const Icon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className="fill-current"><path d={ICON[name]} /></svg>
);

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

  const links = [
    ['/', 'Tela', 'tela'],
    ['/classifica', 'Classifica', 'classifica'],
    [logged ? '/profilo' : '/accedi', logged ? 'Profilo' : 'Accedi', 'profilo'],
  ];

  const showBuy = path !== '/' && path !== '/compra';

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-2 p-3 sm:p-4">
      <Link href="/" className="glass pill pointer-events-auto pl-1.5 pr-3 font-pixel text-[13px] tracking-wider sm:pr-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" width={28} height={28} className="rounded-full" />
        <span className={showBuy ? 'max-[400px]:hidden' : ''}>PIXELIONE</span>
      </Link>
      <nav aria-label="Principale" className="pointer-events-auto flex items-center gap-2">
        <div className="glass flex h-10 items-center gap-0.5 rounded-full p-1">
          {links.map(([href, label, icon]) => {
            const on = path === href;
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={on ? 'page' : undefined}
                className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition sm:px-3 ${on ? 'bg-white text-bg' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon name={icon} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
        {showBuy && (
          <Link href="/compra" className="btn h-10 rounded-full px-4 text-sm">Compra</Link>
        )}
      </nav>
    </header>
  );
}
