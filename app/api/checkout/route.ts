import { randomUUID } from 'node:crypto';
import { CANVAS, MESSAGE_MAX, PRICE_CENTS } from '@/lib/config';
import { db, ensureProfile, fee, getUser, json, moderateImage, siteUrl, stripe } from '@/lib/server';

export const dynamic = 'force-dynamic';

const LOCK_MINUTES = 31; // la sessione Stripe dura 30 minuti (minimo consentito): l'area resta bloccata un minuto in più
const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : NaN);

// Dimensioni dell'immagine PNG dall'intestazione IHDR.
function pngSize(buf: Buffer) {
  const sig = '89504e470d0a1a0a';
  if (buf.length < 24 || buf.subarray(0, 8).toString('hex') !== sig || buf.subarray(12, 16).toString() !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// Prenota l'area, carica l'immagine e apre il checkout Stripe. Prezzo e crediti decisi dal database.
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user) return json({ error: 'Accedi per comprare' }, 401);
  const profile = await ensureProfile(user, req.headers.get('x-ref'));
  if (!profile.username) return json({ error: 'Scegli prima un nome dal profilo' }, 400);

  // Rate limit per utente (finestra fissa) sull'endpoint più costoso (upload + Stripe).
  const { data: allowed } = await db.rpc('rate_hit', { p_key: `checkout:${user.id}`, p_limit: 10, p_window_secs: 60 });
  if (allowed === false) return json({ error: 'Troppi tentativi, riprova tra un minuto' }, 429);
  // Tetto di prenotazioni aperte: stop allo spam di upload e al blocco di molte aree senza pagare.
  const { count: pending } = await db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending');
  if ((pending ?? 0) >= 3) return json({ error: 'Hai già 3 prenotazioni in sospeso: pagale o annullale prima' }, 429);

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: 'Richiesta non valida' }, 400);
  const x = int(body.x), y = int(body.y), w = int(body.w), h = int(body.h);
  if ([x, y, w, h].some(Number.isNaN) || x < 0 || y < 0 || w < 1 || h < 1 || x + w > CANVAS || y + h > CANVAS)
    return json({ error: 'Area fuori dalla tela' }, 400);
  if (body.accept !== true) return json({ error: 'Devi accettare i termini' }, 400);

  let link: string | null = null;
  if (body.link) {
    try {
      const u = new URL(String(body.link));
      if (!/^https?:$/.test(u.protocol) || u.href.length > 500) throw 0;
      link = u.href;
    } catch {
      return json({ error: 'Link non valido (deve iniziare con https://)' }, 400);
    }
  }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MESSAGE_MAX) : '';

  const m = typeof body.image === 'string' && body.image.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return json({ error: 'Immagine mancante' }, 400);
  const png = Buffer.from(m[1], 'base64');
  const size = pngSize(png);
  // L'immagine è a piena qualità (può essere più grande dell'area): deve stare entro la tela e avere
  // le stesse proporzioni dell'area (così non viene deformata). Sulla tela la mostriamo scalata a w×h.
  if (!size || size.w < 1 || size.h < 1 || size.w > CANVAS || size.h > CANVAS)
    return json({ error: 'Immagine non valida' }, 400);
  if (Math.abs(size.w * h - size.h * w) > Math.max(size.w, size.h))
    return json({ error: 'Le proporzioni dell\'immagine non corrispondono all\'area' }, 400);
  if (png.length > 4 * 1024 * 1024) return json({ error: 'Immagine troppo pesante' }, 400);

  // Moderazione automatica opzionale (MODERATION_API_URL). Senza, decide l'admin con rimozione/segnalazioni.
  if (!(await moderateImage(png))) return json({ error: 'Immagine rifiutata dalla moderazione' }, 422);

  const path = `${user.id}/${randomUUID()}.png`;
  // Immagine immutabile dopo l'acquisto: cache lunga sul CDN.
  const up = await db.storage.from('areas').upload(path, png, { contentType: 'image/png', cacheControl: '31536000' });
  if (up.error) return json({ error: 'Caricamento immagine fallito' }, 500);

  const { data: r, error } = await db.rpc('reserve_area', {
    p_user: user.id, p_x: x, p_y: y, p_w: w, p_h: h,
    p_image_path: path, p_link: link, p_message: message,
    p_price_cents: PRICE_CENTS, p_fee_percent: fee.percent, p_fee_fixed_cents: fee.fixedCents, p_lock_minutes: LOCK_MINUTES,
  });
  if (error) {
    await db.storage.from('areas').remove([path]);
    if (error.code === '23P01') return json({ error: 'Qualcuno ha appena preso una parte di quest\'area. Spostala.' }, 409);
    if (error.message?.includes('troppi-ordini-in-sospeso')) return json({ error: 'Hai già 3 prenotazioni in sospeso: pagale o annullale prima' }, 429);
    return json({ error: 'Prenotazione fallita' }, 500);
  }

  const base = siteUrl(req);
  if (r.paid_pixels === 0) return json({ order_id: r.order_id, url: `${base}/ordine?id=${r.order_id}` });

  try {
    const line_items = [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: r.paid_pixels * PRICE_CENTS,
          product_data: {
            name: `${r.paid_pixels} pixel su PIXELIONE`,
            description: `Area ${w}×${h} in posizione ${x},${y}${r.credits_used ? ` (${r.credits_used} pixel pagati con crediti)` : ''}`,
          },
        },
      },
      { quantity: 1, price_data: { currency: 'eur', unit_amount: r.fee_cents, product_data: { name: 'Commissione di pagamento' } } },
    ];
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: user.email,
      client_reference_id: String(r.order_id),
      metadata: { order_id: String(r.order_id) },
      payment_intent_data: { metadata: { order_id: String(r.order_id) } },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${base}/ordine?id=${r.order_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/ordine?id=${r.order_id}&annullato=1`,
      locale: 'it',
    }, { idempotencyKey: `order-${r.order_id}` });
    await db.from('orders').update({ stripe_session_id: session.id }).eq('id', r.order_id);
    return json({ order_id: r.order_id, url: session.url });
  } catch (e) {
    await db.rpc('expire_order', { p_order: r.order_id });
    console.error('stripe', e);
    return json({ error: 'Pagamento non disponibile, riprova' }, 502);
  }
}
