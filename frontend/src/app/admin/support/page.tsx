"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { PageTitle, Panel } from "@/components/admin/Widgets";
import { formatDateTime } from "@/components/admin/texts";
import { failure, useSensitiveAction } from "@/components/settings/AccountActions";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useErrorMessage } from "@/lib/errors";
import { answerSupport, closeSupport, getSupportInbox, getSupportTicket } from "@/services/admin";

const KEY = ["admin", "support"] as const;
const FILTERS = [
  { value: "open", label: "Waiting" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
  { value: "", label: "All" },
] as const;

export default function SupportInboxPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Support />
    </Suspense>
  );
}

function Support() {
  const ticket = useSearchParams().get("t");
  return ticket ? <Ticket uuid={ticket} /> : <Inbox />;
}

function Inbox() {
  const [status, setStatus] = useState<"" | "open" | "answered" | "closed">("open");
  const [page, setPage] = useState(1);
  const errorMessage = useErrorMessage();
  const inbox = useQuery({ queryKey: [...KEY, status, page], queryFn: () => getSupportInbox(status, page) });

  return (
    <>
      <PageTitle hint="Messages from people, from the app, the website and the contact page. Answers reach them in the app, by push and by email.">
        Support {inbox.data ? `· ${inbox.data.open} waiting` : ""}
      </PageTitle>
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${status === f.value ? "border-pine bg-pine-soft" : "border-line"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {inbox.isPending ? (
        <PageLoader />
      ) : inbox.isError ? (
        <LoadError message={errorMessage(inbox.error)} onRetry={() => inbox.refetch()} />
      ) : inbox.data.items.length === 0 ? (
        <p className="text-muted">Nothing here.</p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {inbox.data.items.map((row) => (
              <li key={row.uuid}>
                <Link href={`/admin/support?t=${row.uuid}`} className="block px-5 py-3 hover:bg-ink/[0.03]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold"><bdi>{row.subject}</bdi></span>
                    <span className="tabular shrink-0 text-sm text-muted">{formatDateTime(row.last_message_at)}</span>
                  </div>
                  <p className="text-sm text-muted">
                    {row.topic} · {row.who}
                    {!row.has_account && " (no account)"} · {row.messages} message{row.messages === 1 ? "" : "s"} · {row.status}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Newer
            </Button>
            <Button variant="secondary" disabled={page * 30 >= inbox.data.total} onClick={() => setPage(page + 1)}>
              Older
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function Ticket({ uuid }: { uuid: string }) {
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const { run, dialog } = useSensitiveAction();
  const ticket = useQuery({ queryKey: [...KEY, "ticket", uuid], queryFn: () => getSupportTicket(uuid) });
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await run(async () => {
        await action();
      });
      toast.success(done);
      await queryClient.invalidateQueries({ queryKey: KEY });
    } catch (err) {
      const message = failure(err, errorMessage);
      if (message) toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/admin/support" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Support
      </Link>
      {ticket.isPending ? (
        <PageLoader />
      ) : ticket.isError ? (
        <LoadError message={errorMessage(ticket.error)} onRetry={() => ticket.refetch()} />
      ) : (
        <div className="space-y-6">
          <PageTitle hint={`${ticket.data.topic} · ${ticket.data.status} · ${ticket.data.platform ?? "unknown device"} · language ${ticket.data.locale}`}>
            <bdi>{ticket.data.subject}</bdi>
          </PageTitle>
          <Panel title="From">
            <p className="text-[15px]">
              {ticket.data.who}{" "}
              {ticket.data.user_uuid ? (
                <Link href={`/admin/user?id=${ticket.data.user_uuid}`} className="font-semibold text-pine hover:underline">
                  Open the account
                </Link>
              ) : (
                <span className="text-muted">(no account: answers go by email only)</span>
              )}
            </p>
          </Panel>
          <Panel title="Conversation">
            <ul className="space-y-3">
              {ticket.data.thread.map((m, i) => (
                <li key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${m.from_support ? "ms-auto bg-pine-soft" : "bg-ink/5"}`}>
                  <p className="mb-0.5 text-xs font-semibold text-muted">
                    {m.author} · {formatDateTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap"><bdi>{m.body}</bdi></p>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Answer">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Write in the person's language. They get it in the app, by push and by email."
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                loading={busy}
                disabled={!answer.trim()}
                onClick={() =>
                  act(async () => {
                    await answerSupport(uuid, answer.trim());
                    setAnswer("");
                  }, "Answer sent")
                }
              >
                Send answer
              </Button>
              {ticket.data.status !== "closed" && (
                <Button variant="secondary" loading={busy} onClick={() => act(() => closeSupport(uuid), "Closed")}>
                  Close
                </Button>
              )}
            </div>
          </Panel>
        </div>
      )}
      {dialog}
    </>
  );
}
