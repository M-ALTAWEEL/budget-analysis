/**
 * A square button with only an icon. `label` is required: it is the accessible name and the
 * tooltip. `dot` adds the coral "something new" dot.
 */
export function IconButton({
  label,
  dot,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; dot?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`relative grid size-11 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink transition-[transform,background-color] hover:bg-sunken active:scale-[0.94] ${className}`}
    >
      {children}
      {dot && (
        <span aria-hidden className="absolute end-[11px] top-2.5 size-2 rounded-full bg-coral ring-2 ring-surface" />
      )}
    </button>
  );
}
