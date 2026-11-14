export const metadata = { title: 'Privacy e cookie — PIXELIONE' };

// BOZZA con segnaposto: da completare con i dati del titolare.
export default function Privacy() {
  return (
    <article className="mx-auto max-w-2xl space-y-3 [&_h2]:mt-6 [&_h2]:font-semibold [&_p]:text-white/75">
      <h1 className="text-2xl font-bold">Privacy e cookie</h1>
      <p>Titolare: [RAGIONE SOCIALE / NOME], [INDIRIZZO], info@pixelione.com.</p>
      <h2>Dati trattati</h2>
      <p>Email (accesso e ricevute), nome visibile, aree acquistate con immagine, link e messaggio (pubblici sulla tela), storico ordini. I dati di pagamento li gestisce Stripe: noi non vediamo il numero della carta.</p>
      <h2>Fornitori</h2>
      <p>Supabase (database e accesso, UE), Stripe (pagamenti), [HOSTING]. Ognuno tratta i dati solo per fornire il servizio.</p>
      <h2>Conservazione</h2>
      <p>Account e ordini finché l&apos;account esiste e per gli obblighi fiscali (10 anni per i documenti contabili).</p>
      <h2>Cookie</h2>
      <p>Solo tecnici: la sessione di accesso salvata nel browser. Nessun cookie di profilazione o pubblicità. Stripe usa cookie propri durante il pagamento.</p>
      <h2>I tuoi diritti</h2>
      <p>Accesso, rettifica, cancellazione, portabilità, opposizione: scrivi a info@pixelione.com. Puoi reclamare al Garante per la protezione dei dati personali.</p>
    </article>
  );
}
