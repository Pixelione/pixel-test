export const metadata = { title: 'Rimborsi — PIXELIONE' };

// BOZZA: verificare con il legale l'esclusione del recesso per contenuti digitali (art. 59 Codice del Consumo).
export default function Rimborsi() {
  return (
    <article className="mx-auto max-w-2xl space-y-3 [&_h2]:mt-6 [&_h2]:font-semibold [&_p]:text-white/75">
      <h1 className="text-2xl font-bold">Rimborsi</h1>
      <p>L&apos;area viene pubblicata subito dopo il pagamento, su tua richiesta: per questo [DA DEFINIRE CON IL LEGALE: il diritto di recesso si perde dopo la pubblicazione / hai 14 giorni per chiedere il rimborso].</p>
      <h2>Errori e problemi</h2>
      <p>Se un pagamento va a buon fine ma l&apos;area non compare, scrivi a info@pixelione.com con l&apos;email usata: la sistemiamo o ti rimborsiamo.</p>
      <h2>Cosa succede con un rimborso</h2>
      <p>L&apos;area torna libera, i pixel omaggio usati ti vengono restituiti e quelli ricevuti con quell&apos;acquisto vengono tolti.</p>
      <h2>Rimozione per contenuti vietati</h2>
      <p>Non dà diritto a rimborso in denaro: i pixel tornano come pixel omaggio da usare per una nuova immagine.</p>
    </article>
  );
}
