/**
 * A pill-shaped bar: how much of something is used. The fill grows in from the start side
 * (right in Arabic). `tone` is the fill; `track` the empty part (sunken by default).
 */
export function ProgressPill({
  value,
  tone = "bg-ok",
  track = "bg-sunken",
  height = "h-2",
  label,
}: {
  value: number; // 0..1, clamped
  tone?: string;
  track?: string;
  height?: string;
  label?: string; // when set, the bar is announced as a meter
}) {
  const ratio = Math.min(Math.max(value, 0), 1);
  return (
    <div
      className={`overflow-hidden rounded-full ${height} ${track}`}
      {...(label
        ? { role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(ratio * 100) }
        : { "aria-hidden": true })}
    >
      <div
        className={`h-full origin-left rounded-full rtl:origin-right motion-safe:animate-[ib-grow_900ms_var(--ease-smooth)_200ms_both] ${tone}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
