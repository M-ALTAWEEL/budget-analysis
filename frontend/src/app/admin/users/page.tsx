"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Flag, PageTitle, Pager } from "@/components/admin/Widgets";
import { formatDate } from "@/components/admin/texts";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAdminUsers } from "@/hooks/adminQueries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(query.trim(), 300);
  const { data, isPending, isError, isFetching, refetch } = useAdminUsers(q, page);

  return (
    <>
      <PageTitle hint="Search by the start of an email, username, name or phone number.">Users</PageTitle>

      <label className="mb-5 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:border-pine focus-within:ring-3 focus-within:ring-pine/20">
        <Search className="size-4 text-muted" aria-hidden />
        <span className="sr-only">Search users</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="sara@, @sara, Sara, +90…"
          maxLength={100}
          className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-muted/70"
        />
      </label>

      {isPending ? (
        <PageLoader />
      ) : isError ? (
        <LoadError message="Users could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted" aria-live="polite">
            {data.total} {data.total === 1 ? "account" : "accounts"}
          </p>
          <div className={`overflow-x-auto rounded-2xl border border-line bg-surface ${isFetching ? "opacity-70" : ""}`}>
            <table className="w-full min-w-[640px] text-start text-[15px]">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">Account</th>
                  <th className="px-4 py-3 text-start font-medium">Joined</th>
                  <th className="px-4 py-3 text-start font-medium">Last active</th>
                  <th className="px-4 py-3 text-start font-medium">2FA</th>
                  <th className="px-4 py-3 text-start font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.uuid} className="border-b border-line last:border-0 hover:bg-ink/[0.03]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/user?id=${user.uuid}`} className="font-semibold hover:underline">
                        {user.full_name}
                      </Link>
                      {user.is_admin && (
                        <span className="ms-2 rounded-md bg-marigold-soft px-1.5 py-0.5 text-xs font-semibold text-marigold-ink">
                          Admin
                        </span>
                      )}
                      <p className="text-sm text-muted">
                        {user.email ?? "No email"}
                        {user.username ? ` · @${user.username}` : ""}
                      </p>
                    </td>
                    <td className="tabular px-4 py-3 text-sm">{formatDate(user.created_at)}</td>
                    <td className="tabular px-4 py-3 text-sm">{formatDate(user.last_active_at)}</td>
                    <td className="px-4 py-3">
                      <Flag on={user.two_factor_enabled} yes="On" no="Off" />
                    </td>
                    <td className="px-4 py-3">
                      <Flag on={user.is_active} yes="Active" no="Disabled" />
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No accounts match.
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
