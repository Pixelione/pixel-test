// Regole condivise da browser e server. Prezzi e bonus veri si calcolano nel database (supabase/migrations).
export const CANVAS = 1000; // tela 1000x1000 = un milione di pixel
export const PRICE_CENTS = 100; // 1 € a pixel
export const BONUS_EVERY = 5; // 1 pixel omaggio ogni 5 pagati
export const REFERRAL_PIXELS = 5;
export const MESSAGE_MAX = 100;

export type Area = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  image_url: string;
  link: string | null;
  message: string | null;
  username: string;
};

export const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Stima mostrata prima del pagamento; il totale vero lo calcola il server con la stessa formula.
export function estimate(paidPixels: number, feePercent: number, feeFixedCents: number) {
  if (paidPixels <= 0) return { total: 0, fee: 0 };
  const total = Math.ceil((paidPixels * PRICE_CENTS + feeFixedCents) / (1 - feePercent / 100));
  return { total, fee: total - paidPixels * PRICE_CENTS };
}

export const euro = (cents: number) =>
  (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
