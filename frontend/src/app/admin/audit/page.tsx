"use client";

import Link from "next/link";
import { useState } from "react";

import { PageTitle, Pager } from "@/components/admin/Widgets";
import { ACTION_LABELS, formatDateTime } from "@/components/admin/texts";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAudit } from "@/hooks/adminQueries";

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isFetching, refetch } = useAudit(page);

  return (
    <>
      <PageTitle hint="Every admin action and every admin granted or removed. Nothing here can be changed.">
        Audit log
      </PageTitle>

      {isPending ? (
        <PageLoader />
      ) : isError ? (
        <LoadError message="The audit log could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <div className={`overflow-x-auto rounded-2xl border border-line bg-surface ${isFetching ? "opacity-70" : ""}`}>
            <table className="w-full min-w-[640px] text-[15px]">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">When</th>
                  <th className="px-4 py-3 text-start font-medium">Who</th>
                  <th className="px-4 py-3 text-start font-medium">What</th>
                  <th className="px-4 py-3 text-start font-medium">On</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry, index) => (
                  <tr key={`${entry.created_at}-${index}`} className="border-b border-line last:border-0 align-top">
                    <td className="tabular px-4 py-3 text-sm whitespace-nowrap">{formatDateTime(entry.created_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      {entry.actor}
                      {entry.country && <span className="text-muted"> · {entry.country}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                      {entry.detail && <p className="text-sm text-muted">{entry.detail}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {entry.target_uuid ? (
                        <Link href={`/admin/user?id=${entry.target_uuid}`} className="hover:underline">
                          {entry.target}
                        </Link>
                      ) : entry.target ? (
                        <span className="text-muted">{entry.target} (account deleted)</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted">
                      Nothing yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
