"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { acceptRequest, declineRequest, listMyRequests } from "@/services/groups";

/** Invitations someone sent me by my username: join, or say no thanks. */
export function ReceivedInvitations({ onJoined }: { onJoined: (groupUuid: string) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const requests = useQuery({ queryKey: ["group-requests"], queryFn: listMyRequests });
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["group-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
  };

  const accept = useMutation({
    mutationFn: acceptRequest,
    onSuccess: ({ group_uuid }) => {
      refresh();
      onJoined(group_uuid);
    },
    onError: (err) => setError(errorMessage(err, { 403: t.groups.verifyFirst, 409: t.groups.full })),
  });
  const decline = useMutation({
    mutationFn: declineRequest,
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  if (!requests.data?.length) return null;
  return (
    <section aria-labelledby="invitations" className="mb-10">
      <h2 id="invitations" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        <Mail className="size-5 text-pine" aria-hidden />
        {t.groups.invitations}
      </h2>
      <ul className="space-y-3">
        {requests.data.map((request) => (
          <li
            key={request.uuid}
            className="flex flex-col gap-3 rounded-2xl border border-pine/40 bg-surface px-5 py-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                <bdi>{request.group_name}</bdi>
              </p>
              <p className="text-sm text-muted">
                {request.invited_by && <>{t.groups.invitedYou(request.invited_by)} · </>}
                {t.groups.members(request.member_count, request.member_limit)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                className="h-10 px-4 text-sm"
                loading={accept.isPending && accept.variables === request.uuid}
                onClick={() => {
                  setError(null);
                  accept.mutate(request.uuid);
                }}
              >
                {t.groups.accept}
              </Button>
              <Button
                variant="ghost"
                className="h-10 px-4 text-sm"
                loading={decline.isPending && decline.variables === request.uuid}
                onClick={() => {
                  setError(null);
                  decline.mutate(request.uuid);
                }}
              >
                {t.groups.decline}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <FormError message={error} />
    </section>
  );
}
