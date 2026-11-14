import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Nav from '@/components/Nav';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PIXELIONE — Un milione di pixel, 1 € l\'uno',
  description: 'Compra un\'area della tela, carica la tua immagine e il tuo link. Resta lì per sempre.',
  icons: { icon: '/logo.svg' },
};

export const viewport: Viewport = { themeColor: '#0d0f1a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh font-sans antialiased`}>
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4">{children}</main>
        <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-4 pb-8 text-sm text-white/50">
          <span>© PIXELIONE</span>
          <a href="/termini" className="hover:text-white">Termini</a>
          <a href="/privacy" className="hover:text-white">Privacy e cookie</a>
          <a href="/rimborsi" className="hover:text-white">Rimborsi</a>
          <a href="mailto:info@pixelione.com" className="hover:text-white">Contatti</a>
        </footer>
      </body>
    </html>
  );
}
