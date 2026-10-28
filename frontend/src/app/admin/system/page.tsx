"use client";

import { Flag, PageTitle, Panel } from "@/components/admin/Widgets";
import { formatDateTime } from "@/components/admin/texts";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useSystemStatus } from "@/hooks/adminQueries";

// Rates are fetched again after 12 hours (FX_CACHE_HOURS): older than a day means trouble.
const RATES_STALE_MS = 24 * 60 * 60 * 1000;

export default function AdminSystemPage() {
  const { data: system, isPending, isError, refetch, dataUpdatedAt } = useSystemStatus();

  if (isPending) return <PageLoader />;
  if (isError) return <LoadError message="The status could not be loaded." onRetry={() => void refetch()} />;

  // Measured from when this status was loaded (rendering stays pure: no Date.now()).
  const ratesAge = system.rates_fetched_at
    ? dataUpdatedAt - new Date(system.rates_fetched_at).getTime()
    : null;
  return (
    <>
      <PageTitle hint="What is running and which outside services are switched on. Names only, never keys.">
        System
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Server">
          <Rows>
            <Row label="Database">
              <Flag on={system.database === "ok"} yes="OK" no="Unavailable" />
            </Row>
            <Row label="Environment">
              {system.deploy_env} <span className="text-muted">({system.app_env})</span>
            </Row>
            <Row label="API version">
              <code>{system.commit}</code>
            </Row>
            <Row label="Website version">
              <code>{process.env.NEXT_PUBLIC_COMMIT}</code>
            </Row>
            <Row label="Exchange rates">
              <span className={ratesAge === null || ratesAge > RATES_STALE_MS ? "text-berry" : ""}>
                {system.rates_fetched_at ? `fetched ${formatDateTime(system.rates_fetched_at)}` : "never fetched"}
              </span>
            </Row>
          </Rows>
        </Panel>

        <Panel title="Services">
          <Rows>
            <Row label="Email">
              <Backend name={system.email_backend} />
            </Row>
            <Row label="SMS">
              <Backend name={system.sms_backend} />
            </Row>
            <Row label="Push notifications">
              <Backend name={system.push_backend} />
            </Row>
            <Row label="Sign in with Google">
              <Flag on={system.google_sign_in} yes="On" no="Off" />
            </Row>
            <Row label="Two-factor key">
              <Flag on={system.two_factor_key} yes="Set" no="Missing" />
            </Row>
            <Row label="Redis (shared limits)">
              <Flag on={system.redis} yes="On" no="Off" />
            </Row>
            <Row label="Sentry (error reports)">
              <Flag on={system.sentry} yes="On" no="Off" />
            </Row>
          </Rows>
        </Panel>
      </div>
    </>
  );
}

function Backend({ name }: { name: string }) {
  return <Flag on={name !== "none"} yes={name} no="off" />;
}

function Rows({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-2.5">{children}</dl>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[15px]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}
