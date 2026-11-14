import { NextResponse, type NextRequest } from 'next/server';

const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').origin;

// CSP con nonce per ogni richiesta: Next applica il nonce ai suoi script inline (bootstrap/idratazione).
// 'strict-dynamic' fa fidare degli script caricati dagli script con nonce. Niente 'unsafe-inline' sugli script.
export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'", // stili inline di Next/Tailwind
    `img-src 'self' data: blob: ${supabase}`,
    `connect-src 'self' ${supabase} https://api.stripe.com`,
    'frame-src https://checkout.stripe.com https://js.stripe.com',
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', csp);
  return res;
}

// Tutte le pagine tranne gli asset statici (gli script di Next hanno già il nonce dall'HTML).
export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|logo.svg).*)' }],
};
