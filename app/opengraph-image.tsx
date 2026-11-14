import { ImageResponse } from 'next/og';
import { CANVAS } from '@/lib/config';
import { db } from '@/lib/server';

export const alt = 'PIXELIONE — un milione di pixel, 1 € l\'uno';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Anteprima social generata a runtime, con il conteggio dei pixel venduti.
export default async function Image() {
  let sold = 0;
  try {
    const { data } = await db.from('areas').select('w,h').eq('status', 'active');
    sold = (data ?? []).reduce((s, a) => s + a.w * a.h, 0);
  } catch {}
  const total = CANVAS * CANVAS;
  const pct = Math.max(1.5, (sold / total) * 100);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#07080f', color: '#f4f5fb', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#ffd60a', fontSize: 30, letterSpacing: 4 }}>
          <div style={{ width: 28, height: 28, background: '#ffd60a', borderRadius: 6 }} />
          <div>PIXELIONE</div>
        </div>
        <div style={{ fontSize: 82, fontWeight: 700, marginTop: 24, lineHeight: 1.05 }}>Un milione di pixel.</div>
        <div style={{ fontSize: 82, fontWeight: 700, color: '#ffd60a', lineHeight: 1.05 }}>{'1 € l’uno.'}</div>
        <div style={{ fontSize: 34, color: '#a6a9b8', marginTop: 28 }}>
          {`${sold.toLocaleString('it-IT')} venduti · ${(total - sold).toLocaleString('it-IT')} liberi`}
        </div>
        <div style={{ display: 'flex', width: 1040, height: 18, marginTop: 20, background: '#181c2e', borderRadius: 999 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#ffd60a', borderRadius: 999 }} />
        </div>
      </div>
    ),
    size,
  );
}
