'use client';
import { useEffect, useState } from 'react';
import LoginOptions from '@/components/LoginOptions';
import { supabase } from '@/lib/browser';

// Accesso con Google o con email (Supabase). Al ritorno la sessione si apre da sola e si va a ?next=.
export default function Accedi() {
  const [next, setNext] = useState('/profilo');

  useEffect(() => {
    const n = new URLSearchParams(location.search).get('next');
    const dest = n && n.startsWith('/') && !n.startsWith('//') ? n : '/profilo';
    setNext(dest);
    const go = (s: unknown) => s && location.replace(dest);
    supabase.auth.getSession().then(({ data }) => go(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => go(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="glass mx-auto mt-6 max-w-sm rounded-3xl p-6 sm:mt-12">
      <p className="label">Benvenuto</p>
      <h1 className="mb-5 mt-1 text-2xl font-bold">Accedi o crea l&apos;account</h1>
      <LoginOptions next={next} />
    </div>
  );
}
