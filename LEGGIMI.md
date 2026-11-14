# PIXELIONE — pixel-test

Tela da 1000×1000 pixel a 1 € l'uno. Chi compra carica un'immagine, sceglie con una barra quanti pixel usare
(piena qualità oppure più piccola, quindi meno dettagliata ma più economica), la posiziona e paga con Stripe.

Stack: Next.js 15 (App Router, TypeScript), Tailwind 4, Supabase (Postgres, Auth, Storage), Stripe Checkout.
Il sito di riferimento (copia scaricata di un sito altrui) è servito solo come elenco di funzioni: codice, testi e grafica sono nuovi.

## Avvio in locale

1. `npm install`
2. Copia `.env.example` in `.env.local` e compila le chiavi (Supabase e Stripe **test**).
3. Database: esegui `supabase/migrations/*.sql` nel SQL Editor di Supabase, una volta sola e in ordine.
4. `npm run build` e poi `npm start`. Il sito è su http://localhost:3000
5. Webhook Stripe in locale (in un secondo terminale):
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   Copia il `whsec_...` che stampa in `STRIPE_WEBHOOK_SECRET` e riavvia `npm start`.

Prove: `npm test` (regole di vendita su Postgres in memoria: prezzo, doppia vendita, webhook duplicato,
bonus, inviti, scadenza, rimborso, admin, classifica).

Carta di test: `4242 4242 4242 4242`, data futura qualsiasi, CVC qualsiasi. 3D Secure: `4000 0025 0000 3155`.
Carta rifiutata: `4000 0000 0000 0002`.

## Regole (decise da Francesco il 14/11/2026)

- Prezzo: 1 €/pixel, nessun minimo. Commissione Stripe aggiunta al totale: `ceil((pixel × 1 € + 0,25 €) / (1 − 1,5%))`.
- Pixel omaggio (crediti): 1 ogni 5 pixel pagati; +1 al primo acquisto da almeno 5 pixel per chi era iscritto alla
  lista d'attesa (serve `PRELAUNCH_SUPABASE_*`); 5 a chi invita, al primo acquisto pagato dell'invitato.
  I crediti si usano per primi nell'acquisto successivo e non contano in classifica.
- Immagine e link non si cambiano dopo l'acquisto. L'admin può cancellare aree e i pixel tornano al proprietario come crediti.
- Classifica per pixel pagati: oggi, settimana (da lunedì), sempre, ora italiana.

## Come funziona il pagamento

1. `POST /api/checkout`: controlla area, link e immagine (PNG già ridotto a w×h nel browser), la carica su Storage,
   prenota l'area nel database (31 minuti) e apre Stripe Checkout (30 minuti).
2. La sovrapposizione è impossibile: vincolo `areas_no_overlap` nel database.
3. I pixel si assegnano solo con `checkout.session.completed` (firma verificata) o, se il webhook tarda,
   dalla pagina `/ordine` che chiede lo stato a Stripe. Entrambi usano `complete_order`, idempotente.
4. Sessione scaduta o "annulla": area libera, crediti restituiti. Rimborso totale o contestazione: area libera, bonus ripresi.

## Pagine

`/` tela · `/compra` acquisto · `/accedi` link via email · `/profilo` aree, crediti, ordini, link invito ·
`/classifica` · `/admin` (solo `ADMIN_EMAILS`): cerca un account o trascina un rettangolo sulla tela, spunta le aree,
cancella e riaccredita · `/termini` `/privacy` `/rimborsi` (bozze con segnaposto `[...]`).

## Prima di andare online (non fatto)

- Hosting (es. Vercel) con le stesse variabili; in Supabase > Authentication > URL Configuration impostare
  Site URL e Redirect URL del dominio vero.
- Webhook in Stripe Dashboard verso `https://DOMINIO/api/stripe/webhook` con gli eventi:
  `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`.
- Email di accesso: Supabase gratuito ne manda poche all'ora. Collegare Resend come SMTP in Supabase > Authentication > SMTP.
- Accesso con Google: in Google Cloud creare un client OAuth "Applicazione web" con URI di reindirizzamento
  `https://bsskgvciqoomxvtduewm.supabase.co/auth/v1/callback`, poi incollare ID e segreto in Supabase >
  Authentication > Sign In / Providers > Google. Il pulsante compare da solo quando il provider è attivo.
- Codice a 6 cifre nell'email: con SMTP proprio, aggiungere `{{ .Token }}` al modello "Magic link or OTP".
  Il campo per il codice c'è già nella pagina di accesso.
- Commercialista (IVA, dati fiscali nelle pagine legali), poi chiavi live, un acquisto e un rimborso veri.
- Manutenzione: pianificare `GET /api/cron/reconcile` (ogni 1-5 min) con header `authorization: Bearer <CRON_SECRET>`
  (libera i lock scaduti e recupera i pagamenti il cui webhook si fosse perso). In alternativa `pg_cron` è già
  schedulato per `release_expired`. In produzione, impostare `CRON_SECRET`.
- Moderazione immagini (facoltativa): impostare `MODERATION_API_URL` (e `MODERATION_API_KEY`) verso un servizio che
  riceve il PNG e risponde `{ "allowed": boolean }`. Senza, resta la rimozione admin + le segnalazioni degli utenti.
- CSP: è in `middleware.ts` con nonce per richiesta; le pagine sono rese dinamiche apposta (`app/layout.tsx`).

