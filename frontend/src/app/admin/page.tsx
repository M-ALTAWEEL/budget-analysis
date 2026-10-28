"use client";

import { DayBars, PageTitle, Panel, StatCard } from "@/components/admin/Widgets";
import { percent } from "@/components/admin/texts";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAdminStats } from "@/hooks/adminQueries";

export default function AdminOverviewPage() {
  const { data: stats, isPending, isError, refetch } = useAdminStats();

  if (isPending) return <PageLoader />;
  if (isError) return <LoadError message="The numbers could not be loaded." onRetry={() => void refetch()} />;

  const users = stats.users_total;
  return (
    <>
      <PageTitle hint="Counts across everyone. No one's money is ever shown here.">Overview</PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={users} note={`${stats.users_disabled} disabled`} />
        <StatCard label="Active, 7 days" value={stats.active_7_days} note={percent(stats.active_7_days, users)} />
        <StatCard label="Active, 30 days" value={stats.active_30_days} note={percent(stats.active_30_days, users)} />
        <StatCard
          label="Groups"
          value={stats.groups_total}
          note={`${stats.groups_active} active`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DayBars title="Sign-ups per day" days={stats.signups_per_day} />
        <DayBars title="Expenses added per day" days={stats.expenses_per_day} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="How people sign in">
          <Rows
            rows={[
              ["Password", stats.with_password],
              ["Google", stats.with_google],
              ["Phone", stats.with_phone],
            ]}
            total={users}
          />
        </Panel>
        <Panel title="Account safety">
          <Rows
            rows={[
              ["Two-factor on", stats.two_factor_on],
              ["Email confirmed", stats.email_verified],
              ["Phones with notifications", stats.push_devices],
            ]}
            total={users}
          />
        </Panel>
      </div>
    </>
  );
}

function Rows({ rows, total }: { rows: [string, number][]; total: number }) {
  return (
    <dl className="space-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 text-[15px]">
          <dt className="text-muted">{label}</dt>
          <dd className="tabular font-semibold">
            {value} <span className="text-sm font-normal text-muted">({percent(value, total)})</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
