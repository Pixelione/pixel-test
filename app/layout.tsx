import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Silkscreen, Space_Grotesk } from 'next/font/google';
import Nav from '@/components/Nav';
import './globals.css';

const body = Space_Grotesk({ variable: '--font-body', subsets: ['latin'] });
const code = JetBrains_Mono({ variable: '--font-code', subsets: ['latin'] });
const pixel = Silkscreen({ variable: '--font-pixel', subsets: ['latin'], weight: ['400', '700'] });

const title = 'PIXELIONE — Un milione di pixel, 1 € l\'uno';
const description = 'Compra un\'area della tela, carica la tua immagine e il tuo link. Resta lì per sempre.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title,
  description,
  icons: { icon: '/logo.svg' },
  openGraph: { title, description, type: 'website', locale: 'it_IT', siteName: 'PIXELIONE' },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport: Viewport = { themeColor: '#07080f', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Rendering dinamico per richiesta: serve alla CSP con nonce (middleware.ts) di finire negli script di Next.
export const dynamic = 'force-dynamic';

// La tela (/) e l'acquisto (/compra) sono a schermo intero; le altre pagine usano app/(pagine)/layout.tsx.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className={`${body.variable} ${code.variable} ${pixel.variable} min-h-dvh font-sans antialiased`}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
