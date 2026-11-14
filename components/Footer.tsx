export const LEGAL = [
  ['/termini', 'Termini'],
  ['/privacy', 'Privacy e cookie'],
  ['/rimborsi', 'Rimborsi'],
  ['mailto:info@pixelione.com', 'Contatti'],
];

export default function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-5 gap-y-2 border-t border-white/[.06] px-4 py-8 text-sm text-white/45">
      <span className="font-pixel text-xs text-white/60">© PIXELIONE</span>
      {LEGAL.map(([h, l]) => (
        <a key={h} href={h} className="hover:text-white">{l}</a>
      ))}
    </footer>
  );
}
