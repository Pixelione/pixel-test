import Footer from '@/components/Footer';

// Pagine normali (classifica, profilo, legali...): spazio per la barra in alto e piè di pagina.
export default function Pagine({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,214,10,.10),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      <main className="mx-auto w-full flex-1 max-w-6xl px-4 pb-16 pt-24">{children}</main>
      <Footer />
    </div>
  );
}
