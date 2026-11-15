export const metadata = { title: 'Rimborsi — PIXELIONE' };

// Recesso: contenuto digitale fornito subito con consenso dell'utente (checkbox in acquisto) -> art. 59 Codice del Consumo.
export default function Rimborsi() {
  return (
    <article className="mx-auto max-w-2xl space-y-3 [&_h2]:mt-6 [&_h2]:font-semibold [&_p]:text-white/75">
      <h1 className="text-2xl font-bold">Rimborsi</h1>
      <p>L&apos;area viene pubblicata subito dopo il pagamento, su tua richiesta e con il tuo consenso espresso in fase di acquisto: per questo, trattandosi di contenuto digitale fornito immediatamente, il diritto di recesso si perde con la pubblicazione (art. 59 Codice del Consumo).</p>
      <h2>Errori e problemi</h2>
      <p>Se un pagamento va a buon fine ma l&apos;area non compare, scrivi a f3013032@gmail.com con l&apos;email usata: la sistemiamo o ti rimborsiamo.</p>
      <h2>Cosa succede con un rimborso</h2>
      <p>L&apos;area torna libera, i pixel omaggio usati ti vengono restituiti e quelli ricevuti con quell&apos;acquisto vengono tolti.</p>
      <h2>Rimozione per contenuti vietati</h2>
      <p>Non dà diritto a rimborso in denaro: i pixel tornano come pixel omaggio da usare per una nuova immagine.</p>
    </article>
  );
}
