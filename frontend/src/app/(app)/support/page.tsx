"use client";

import { ArrowLeft, ChevronDown, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { SupportForm } from "@/components/support/SupportForm";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useOpenSupport, useReplyToSupport, useSupport, useWriteToSupport } from "@/hooks/queries";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import type { SupportTicket } from "@/types/api";

/** Customer support: write to the team, and read and answer their replies. */
export default function SupportPage() {
  const tickets = useSupport();
  const write = useWriteToSupport();
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Link href="/settings" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t.nav.settings}
      </Link>
      <header className="mb-8">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <LifeBuoy className="size-6 text-pine" aria-hidden />
          {t.support.title}
        </h1>
        <p className="mt-1 max-w-prose text-[15px] text-muted">{t.support.intro}</p>
      </header>

      <section className="mb-10 rounded-2xl border border-line bg-surface px-5 py-5">
        <h2 className="mb-4 font-display text-lg font-semibold">{t.support.newTitle}</h2>
        <SupportForm
          sending={write.isPending}
          error={error}
          onSend={async (input) => {
            setError(null);
            try {
              await write.mutateAsync(input);
              toast.success(t.support.sent);
              return true;
            } catch (err) {
              setError(errorMessage(err));
              return false;
            }
          }}
        />
      </section>

      {tickets.isPending ? (
        <PageLoader />
      ) : tickets.isError ? (
        <LoadError message={errorMessage(tickets.error)} onRetry={() => tickets.refetch()} />
      ) : tickets.data.length === 0 ? (
        <p className="text-[15px] text-muted">{t.support.empty}</p>
      ) : (
        <ul className="space-y-3">
          {tickets.data.map((ticket) => (
            <Conversation key={ticket.uuid} ticket={ticket} />
          ))}
        </ul>
      )}
    </>
  );
}

function Conversation({ ticket }: { ticket: SupportTicket }) {
  const { t, shortDate } = useI18n();
  const errorMessage = useErrorMessage();
  const open = useOpenSupport();
  const reply = useReplyToSupport();
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const tone = ticket.status === "answered" ? "text-pine" : ticket.status === "closed" ? "text-muted" : "text-marigold";

  function toggle() {
    if (!expanded && ticket.unread) open.mutate(ticket.uuid);
    setExpanded(!expanded);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    try {
      await reply.mutateAsync({ uuid: ticket.uuid, message: text.trim() });
      setText("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-surface">
      <button type="button" onClick={toggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-5 py-4 text-start">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold"><bdi>{ticket.subject}</bdi></span>
            {ticket.unread && <span className="shrink-0 rounded-full bg-pine px-2 py-0.5 text-xs font-semibold text-white">{t.support.newAnswer}</span>}
          </span>
          <span className="text-sm text-muted">
            {t.support.topics[ticket.topic]} · {shortDate(ticket.last_message_at.slice(0, 10))} ·{" "}
            <span className={`font-semibold ${tone}`}>{t.support.status[ticket.status]}</span>
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {expanded && (
        <div className="border-t border-line px-5 py-4">
          <ul className="space-y-3">
            {ticket.messages.map((m, i) => (
              <li key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] ${m.from_support ? "bg-pine-soft" : "ms-auto bg-ink/5"}`}>
                <p className="mb-0.5 text-xs font-semibold text-muted">{m.from_support ? t.support.team : t.support.you}</p>
                <p className="whitespace-pre-wrap"><bdi>{m.body}</bdi></p>
              </li>
            ))}
          </ul>
          <form onSubmit={send} className="mt-4 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.support.replyPlaceholder}
              maxLength={4000}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2 text-[15px]"
            />
            <Button type="submit" variant="secondary" loading={reply.isPending}>
              {t.support.reply}
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}
