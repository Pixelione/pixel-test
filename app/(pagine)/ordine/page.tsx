'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/browser';
import { euro } from '@/lib/config';

type Order = { id: number; area_id: number; pixels: number; paid_pixels: number; credits_used: number; bonus_pixels: number; amount_cents: number; status: string };

export default function Ordine() {
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<'wait' | 'paid' | 'cancelled' | 'error'>('wait');

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const id = q.get('id');
    if (!id) return setState('error');
    if (q.get('annullato')) {
      api(`/api/order/${id}`, { method: 'POST' }).finally(() => setState('cancelled'));
      return;
    }
    let tries = 0;
    let t: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const o = await api<Order>(`/api/order/${id}`);
        setOrder(o);
        if (o.status === 'paid') return setState('paid');
        if (o.status !== 'pending') return setState('error');
      } catch {}
      if (++tries < 30) t = setTimeout(poll, 2000);
      else setState('error');
    };
    poll();
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="card mx-auto mt-10 max-w-md space-y-3 text-center">
      {state === 'wait' && <p>Confermo il pagamento…</p>}
      {state === 'paid' && order && (
        <>
          <h1 className="text-2xl font-bold">Fatto! I tuoi {order.pixels} pixel sono sulla tela.</h1>
          {order.amount_cents > 0 && <p className="text-white/65">Pagati {euro(order.amount_cents)}. La ricevuta arriva da Stripe via email.</p>}
          {order.bonus_pixels > 0 && <p className="text-gold">+{order.bonus_pixels} pixel omaggio nel tuo profilo.</p>}
          <button
            type="button"
            className="btn mx-auto"
            onClick={() => {
              const url = `${location.origin}/a/${order.area_id}`;
              if (navigator.share) navigator.share({ title: 'PIXELIONE', text: 'La mia area su PIXELIONE', url }).catch(() => {});
              else navigator.clipboard.writeText(url).catch(() => {});
            }}
          >
            Condividi la tua area
          </button>
          <div className="flex justify-center gap-2"><Link href={`/a/${order.area_id}`} className="btn-ghost">Vedi la pagina</Link><Link href="/" className="btn-ghost">Tela</Link></div>
        </>
      )}
      {state === 'cancelled' && (
        <>
          <h1 className="text-xl font-bold">Pagamento annullato</h1>
          <p className="text-white/65">Nessun addebito. L&apos;area è di nuovo libera.</p>
          <Link href="/compra" className="btn">Riprova</Link>
        </>
      )}
      {state === 'error' && (
        <>
          <h1 className="text-xl font-bold">Pagamento non confermato</h1>
          <p className="text-white/65">Se ti è stato addebitato qualcosa scrivi a f3013032@gmail.com con l&apos;email usata.</p>
          <Link href="/profilo" className="btn-ghost">Vai al profilo</Link>
        </>
      )}
    </div>
  );
}
