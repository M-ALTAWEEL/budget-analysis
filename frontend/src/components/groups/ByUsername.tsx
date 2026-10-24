"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AtSign } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import {
  cancelRequest,
  inviteByUsername,
  listSentRequests,
  type GroupDetail,
} from "@/services/groups";

/** Admins: invite someone by their username, and see who hasn't answered yet. */
export function ByUsername({ group }: { group: GroupDetail }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const key = ["groups", group.uuid, "requests"];
  const pending = useQuery({ queryKey: key, queryFn: () => listSentRequests(group.uuid) });
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const full = group.member_count >= group.member_limit;

  const send = useMutation({
    mutationFn: () => inviteByUsername(group.uuid, username.trim()),
    onSuccess: (request) => {
      setSentTo(request.display_name);
      setUsername("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (err) => {
      const detail = isAxiosError(err) ? String(err.response?.data?.detail ?? "") : "";
      setError(
        errorMessage(err, {
          404: t.groups.noSuchUser,
          403: t.errors.forbidden,
          409: detail.includes("full")
            ? t.groups.full
            : detail.includes("said no")
              ? t.groups.declinedRecently
              : t.groups.alreadyMember,
        }),
      );
    },
  });
  const cancel = useMutation({
    mutationFn: (requestUuid: string) => cancelRequest(group.uuid, requestUuid),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t.groups.byUsername}</p>
      <p className="text-sm text-muted">{t.groups.byUsernameText}</p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setSentTo(null);
          if (username.trim()) send.mutate();
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">{t.groups.byUsername}</span>
          <AtSign className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t.groups.usernamePlaceholder.replace("@", "")}
            maxLength={21}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={full}
            className="h-11 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-[15px]"
          />
        </label>
        <Button type="submit" variant="secondary" loading={send.isPending} disabled={full || !username.trim()}>
          {t.groups.send}
        </Button>
      </form>
      <FormError message={error} />
      {sentTo && (
        <p role="status" className="text-sm text-pine">
          {t.groups.sentTo(sentTo)}
        </p>
      )}
      {(pending.data?.length ?? 0) > 0 && (
        <ul className="space-y-1.5 text-sm">
          {pending.data?.map((request) => (
            <li key={request.uuid} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">
                <bdi className="font-semibold">{request.display_name}</bdi>
                {request.username && (
                  <span className="ms-1 text-muted" dir="ltr">
                    @{request.username}
                  </span>
                )}
                <span className="ms-2 text-muted">· {t.groups.waiting}</span>
              </span>
              <button
                type="button"
                onClick={() => cancel.mutate(request.uuid)}
                className="shrink-0 font-semibold text-berry hover:underline"
              >
                {t.groups.cancel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
