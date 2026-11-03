/**
 * A white card on the page: hairline border, soft shadow, rounded-card corners
 * (docs/design/design-system.md). `as` keeps the right element (section, article, li).
 */
export function Card({
  as: Tag = "section",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "section" | "article" | "div" | "li" | "aside" }) {
  return (
    <Tag
      {...props}
      className={`flex min-w-0 flex-col gap-3.5 rounded-card border border-line bg-surface p-5 shadow-card ${className}`}
    >
      {children}
    </Tag>
  );
}

/** A card's title row: the title, and an optional link or control at the end. */
export function CardHeader({
  title,
  id,
  action,
}: {
  title: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <h2 id={id} className="font-display text-base font-semibold tracking-tight">
        {title}
      </h2>
      {action}
    </div>
  );
}
