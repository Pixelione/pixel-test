export const metadata = { title: 'Termini — PIXELIONE' };

// BOZZA con segnaposto: da far rivedere al commercialista/legale prima dei pagamenti veri.
export default function Termini() {
  return (
    <article className="prose-sm mx-auto max-w-2xl space-y-3 [&_h2]:mt-6 [&_h2]:font-semibold [&_p]:text-white/75">
      <h1 className="text-2xl font-bold">Termini e condizioni</h1>
      <p>Servizio offerto da [RAGIONE SOCIALE / NOME], [INDIRIZZO], P.IVA [PARTITA IVA], email info@pixelione.com.</p>
      <h2>Cosa compri</h2>
      <p>Acquisti uno spazio pubblicitario su una tela digitale di 1000×1000 pixel: un&apos;area rettangolare in cui viene mostrata l&apos;immagine che carichi, con un link e un messaggio facoltativi. Non acquisti quote, investimenti o diritti sul sito.</p>
      <h2>Prezzo</h2>
      <p>1 € per pixel, IVA [inclusa/esclusa — DA DEFINIRE]. Al totale si aggiunge la commissione di pagamento mostrata prima di pagare. Pagamento tramite Stripe.</p>
      <h2>Pixel omaggio</h2>
      <p>Ogni 5 pixel pagati ricevi 1 pixel omaggio. Chi si è iscritto alla lista d&apos;attesa prima del lancio riceve 1 pixel in più al primo acquisto di almeno 5 pixel. Chi invita un nuovo acquirente riceve 5 pixel al suo primo acquisto. I pixel omaggio non hanno valore in denaro, non si convertono né si rimborsano e non contano in classifica.</p>
      <h2>Durata e modifiche</h2>
      <p>L&apos;area resta pubblicata finché il sito è online. Immagine, link e messaggio non si possono cambiare dopo l&apos;acquisto.</p>
      <h2>Contenuti vietati</h2>
      <p>Vietati contenuti d&apos;odio, per adulti, violenti, illegali, ingannevoli, marchi o immagini di cui non hai i diritti. Possiamo rimuovere un&apos;area che viola queste regole; in tal caso i pixel ti vengono restituiti come pixel omaggio.</p>
      <h2>Legge applicabile</h2>
      <p>Legge italiana. Per i consumatori resta competente il foro di residenza.</p>
    </article>
  );
}
