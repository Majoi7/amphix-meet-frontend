export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ borderTop: "1px solid var(--dash-border)" }}
    >
      <p className="text-[12px] tabular-nums" style={{ color: "var(--dash-text-muted)" }}>
        Page {page} sur {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="dash-btn dash-btn-secondary h-8 px-3 text-[12.5px]"
        >
          Précédent
        </button>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          className="dash-btn dash-btn-secondary h-8 px-3 text-[12.5px]"
        >
          Suivant
        </button>
      </div>
    </nav>
  );
}
