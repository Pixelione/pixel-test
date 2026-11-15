import { ImageResponse } from 'next/og';
import { db, imageUrl } from '@/lib/server';

export const alt = 'Area su PIXELIONE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Anteprima social della singola area: l'immagine dell'area + nome e misura.
export default async function Image({ params }: { params: { id: string } }) {
  const { data } = await db.rpc('area_detail', { p_id: Number(params.id) });
  const a = data?.[0];
  const box = { display: 'flex', width: '100%', height: '100%', background: '#07080f', color: '#f4f5fb', fontFamily: 'monospace' } as const;

  if (!a)
    return new ImageResponse(
      (<div style={{ ...box, alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>PIXELIONE</div>),
      size,
    );

  return new ImageResponse(
    (
      <div style={{ ...box, flexDirection: 'column', padding: 70 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#ffd60a', fontSize: 26, letterSpacing: 4 }}>
          <div style={{ width: 24, height: 24, background: '#ffd60a', borderRadius: 5 }} />
          <div>PIXELIONE</div>
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 56, marginTop: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(a.image_path)} width={460} height={Math.round((460 * a.h) / a.w)} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,.15)', objectFit: 'contain', background: '#000' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 64, fontWeight: 700 }}>{a.username}</div>
            <div style={{ fontSize: 30, color: '#a6a9b8', marginTop: 10 }}>{`${a.w}×${a.h} pixel sulla tela`}</div>
            <div style={{ fontSize: 30, color: '#ffd60a', marginTop: 24 }}>Prendi anche tu un pezzo di internet</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
