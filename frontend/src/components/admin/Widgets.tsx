import type { DayCount } from "@/types/admin";

export function PageTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-2xl font-semibold">{children}</h1>
      {hint && <p className="mt-1 text-[15px] text-muted">{hint}</p>}
    </header>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface px-5 py-4">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function StatCard({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-semibold">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

/** Yes / no as a coloured word: never colour alone. */
export function Flag({ on, yes = "Yes", no = "No" }: { on: boolean; yes?: string; no?: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
        on ? "bg-pine-soft text-pine-dark" : "bg-ink/5 text-muted"
      }`}
    >
      {on ? yes : no}
    </span>
  );
}

/** One bar per day, with the same numbers in a table for screen readers. */
export function DayBars({ title, days }: { title: string; days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const label = (day: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(day));
  return (
    <Panel title={title}>
      <p className="mb-3 text-sm text-muted">
        <span className="tabular font-semibold text-ink">{total}</span> in the last {days.length} days
      </p>
      <div className="flex h-32 items-end gap-[3px]" aria-hidden>
        {days.map((d) => (
          <div
            key={d.day}
            title={`${label(d.day)}: ${d.count}`}
            className="flex-1 rounded-t-sm bg-pine/80"
            style={{ height: `${d.count === 0 ? 2 : Math.max(6, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden>
        <span>{days.length ? label(days[0].day) : ""}</span>
        <span>{days.length ? label(days[days.length - 1].day) : ""}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{label(d.day)}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  const button = "h-9 rounded-lg border border-line bg-surface px-3 text-sm disabled:opacity-50";
  return (
    <nav className="mt-4 flex items-center justify-end gap-3 text-sm" aria-label="Pages">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="tabular text-muted">
        Page {page} of {pages}
      </span>
      <button type="button" className={button} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
