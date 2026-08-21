/**
 * The Folio mark: a sheet with a folded corner, drawn in a single colour so it
 * reads correctly on both light and dark surfaces.
 */
export default function BrandMark({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <path d="M20 12h16l10 10v26a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z"
        stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M36 12v10h10" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M24 34h16M24 42h11" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
