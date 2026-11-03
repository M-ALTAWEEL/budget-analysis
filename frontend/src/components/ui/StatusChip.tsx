export type Status = "ok" | "warn" | "bad" | "brand";

const TONES: Record<Status, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-marigold-soft text-marigold-ink",
  bad: "bg-berry-soft text-berry",
  brand: "bg-brand-soft text-brand",
};

/** A small pill with a dot: on track, careful, over, or a neutral brand label. */
export function StatusChip({ status, children }: { status: Status; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[status]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
