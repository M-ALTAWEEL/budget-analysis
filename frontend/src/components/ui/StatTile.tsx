/** A small framed number: a label, the value (with an optional unit), and a note under it. */
export function StatTile({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-2xl border border-line px-3.5 py-3">
      <span className="text-xs text-muted">{label}</span>
      <b className="tabular text-xl font-semibold tracking-tight">
        {value}
        {unit && <small className="ms-1 text-[0.68em] font-medium tracking-normal text-muted">{unit}</small>}
      </b>
      {note && <span className="truncate text-[11.5px] text-muted">{note}</span>}
    </div>
  );
}
