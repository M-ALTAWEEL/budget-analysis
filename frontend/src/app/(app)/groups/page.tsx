"use client";

import { AnimatePresence } from "motion/react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CreateGroupSheet } from "@/components/groups/CreateGroupSheet";
import { GroupView } from "@/components/groups/GroupView";
import { ReceivedInvitations } from "@/components/groups/ReceivedInvitations";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { listGroups } from "@/services/groups";

export default function GroupsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Groups />
    </Suspense>
  );
}

// One page: the list, or one group when the address has ?g=<uuid> (so it can be linked to).
function Groups() {
  const params = useSearchParams();
  const router = useRouter();
  const open = (uuid: string | null) => router.push(uuid ? `/groups?g=${uuid}` : "/groups");
  const selected = params.get("g");
  if (selected) return <GroupView uuid={selected} onBack={() => open(null)} />;
  return <GroupList onOpen={open} />;
}

function GroupList({ onOpen }: { onOpen: (uuid: string) => void }) {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const groups = useQuery({ queryKey: ["groups"], queryFn: listGroups });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t.groups.title}</h1>
          <p className="mt-1 max-w-prose text-[15px] text-muted">{t.groups.intro}</p>
        </div>
        <Button className="shrink-0" onClick={() => setCreating(true)}>
          <Plus className="size-5" aria-hidden />
          {t.groups.create}
        </Button>
      </header>

      <ReceivedInvitations onJoined={onOpen} />

      {groups.isPending ? (
        <PageLoader />
      ) : groups.isError ? (
        <LoadError message={errorMessage(groups.error)} onRetry={() => groups.refetch()} />
      ) : groups.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-[15px] text-muted">
          {t.groups.empty}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {groups.data.map((group) => (
            <li key={group.uuid}>
              <button
                type="button"
                onClick={() => onOpen(group.uuid)}
                className="flex w-full items-center gap-4 px-5 py-4 text-start hover:bg-ink/[0.03]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine/10 text-pine">
                  <Users className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    <bdi>{group.name}</bdi>
                  </span>
                  <span className="block text-sm text-muted">
                    {group.currency} · {t.groups.members(group.member_count, group.member_limit)} ·{" "}
                    {t.groups.roles[group.my_role]}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted rtl:-scale-x-100" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {creating && (
          <CreateGroupSheet
            onClose={() => setCreating(false)}
            onCreated={(group) => {
              setCreating(false);
              onOpen(group.uuid);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
