"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Crown, LogOut, Share2, Shield, UserMinus, Users } from "lucide-react";
import { useState } from "react";

import { ByUsername } from "@/components/groups/ByUsername";
import { GroupExpenses } from "@/components/groups/GroupExpenses";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { LoadError } from "@/components/ui/LoadError";
import { PageLoader } from "@/components/ui/PageLoader";
import { LOCALE_INFO } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import {
  createInvite,
  getGroup,
  listInvites,
  removeMember,
  revokeInvite,
  setMemberRole,
  updateGroup,
  type GroupDetail,
  type GroupMember,
  type Invite,
} from "@/services/groups";

export const groupKey = (uuid: string) => ["groups", uuid] as const;

/** One group: expenses, members, invite links, settings, leaving. */
export function GroupView({ uuid, onBack }: { uuid: string; onBack: () => void }) {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const group = useQuery({ queryKey: groupKey(uuid), queryFn: () => getGroup(uuid) });

  if (group.isPending) return <PageLoader />;
  if (group.isError) {
    return (
      <>
        <BackLink onBack={onBack} />
        <LoadError message={errorMessage(group.error)} onRetry={() => group.refetch()} />
      </>
    );
  }
  const g = group.data;
  const admin = g.my_role === "owner" || g.my_role === "admin";

  return (
    <>
      <BackLink onBack={onBack} />
      <header className="mb-8">
        <h1 className="font-display text-2xl font-semibold">{g.name}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {g.currency} · {t.groups.members(g.member_count, g.member_limit)}
        </p>
      </header>
      <div className="space-y-10">
        <GroupExpenses group={g} />
        <Members group={g} />
        {admin && <Invites group={g} />}
        {g.my_role === "owner" && <GroupSettings group={g} />}
        <Leave group={g} onLeft={onBack} />
      </div>
    </>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-pine hover:underline"
    >
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
      {t.groups.back}
    </button>
  );
}

function Members({ group }: { group: GroupDetail }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: groupKey(group.uuid) });

  const role = useMutation({
    mutationFn: ({ member, to }: { member: GroupMember; to: "admin" | "member" }) =>
      setMemberRole(group.uuid, member.uuid, to),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (member: GroupMember) => removeMember(group.uuid, member.uuid),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <section aria-labelledby="members">
      <h2 id="members" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
        <Users className="size-5 text-muted" aria-hidden />
        {t.groups.members(group.member_count, group.member_limit)}
      </h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {group.members.map((member) => {
          const canManage =
            !member.is_me &&
            !member.left &&
            (group.my_role === "owner" || (group.my_role === "admin" && member.role === "member"));
          return (
            <li key={member.uuid} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <RoleIcon role={member.role} />
              <div className="min-w-0 flex-1">
                <p className={member.left ? "text-muted line-through" : "font-semibold"}>
                  <bdi>{member.display_name}</bdi>
                  {member.is_me && <span className="ms-2 text-sm font-normal text-muted">({t.groups.you})</span>}
                </p>
                <p className="text-sm text-muted">
                  {member.left ? t.groups.left : t.groups.roles[member.role]}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  {group.my_role === "owner" && member.role !== "owner" && (
                    <Button
                      variant="ghost"
                      className="h-9 px-3 text-sm"
                      onClick={() =>
                        role.mutate({ member, to: member.role === "admin" ? "member" : "admin" })
                      }
                    >
                      {member.role === "admin" ? t.groups.makeMember : t.groups.makeAdmin}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="h-9 px-3 text-sm text-berry"
                    onClick={() => remove.mutate(member)}
                    aria-label={`${t.groups.remove}: ${member.display_name}`}
                  >
                    <UserMinus className="size-4" aria-hidden />
                    {t.groups.remove}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <FormError message={error} />
    </section>
  );
}

function RoleIcon({ role }: { role: GroupMember["role"] }) {
  if (role === "owner") return <Crown className="size-5 shrink-0 text-pine" aria-hidden />;
  if (role === "admin") return <Shield className="size-5 shrink-0 text-pine" aria-hidden />;
  return <span className="size-5 shrink-0" aria-hidden />;
}

function Invites({ group }: { group: GroupDetail }) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const invitesKey = ["groups", group.uuid, "invites"];
  const invites = useQuery({ queryKey: invitesKey, queryFn: () => listInvites(group.uuid) });
  const [fresh, setFresh] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = group.member_count >= group.member_limit;

  const create = useMutation({
    mutationFn: () => createInvite(group.uuid),
    onSuccess: (invite) => {
      setFresh(invite);
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: invitesKey });
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: (inviteUuid: string) => revokeInvite(group.uuid, inviteUuid),
    onSuccess: (_, inviteUuid) => {
      if (fresh?.uuid === inviteUuid) setFresh(null);
      void queryClient.invalidateQueries({ queryKey: invitesKey });
    },
  });
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(LOCALE_INFO[locale].intl, { day: "numeric", month: "short" });

  return (
    <section aria-labelledby="invite">
      <h2 id="invite" className="mb-1 font-display text-lg font-semibold">
        {t.groups.invite}
      </h2>
      <p className="mb-3 text-sm text-muted">{full ? t.groups.full : t.groups.inviteText}</p>
      <div className="space-y-4 rounded-2xl border border-line bg-surface px-5 py-4">
        {fresh?.url ? (
          <div className="space-y-3">
            {fresh.qr_svg && (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URI, nothing to optimise
              <img
                src={fresh.qr_svg}
                alt=""
                width={180}
                height={180}
                className="mx-auto rounded-xl bg-white p-2"
              />
            )}
            <p dir="ltr" className="break-all rounded-lg bg-ink/5 px-3 py-2 font-mono text-xs">
              {fresh.url}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard.writeText(fresh.url ?? "").then(() => setCopied(true), () => undefined)
                }
              >
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? t.groups.linkCopied : t.groups.copyLink}
              </Button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  variant="secondary"
                  onClick={() => void navigator.share({ title: group.name, url: fresh.url ?? "" }).catch(() => undefined)}
                >
                  <Share2 className="size-4" aria-hidden />
                  {t.groups.share}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button variant="secondary" loading={create.isPending} disabled={full} onClick={() => create.mutate()}>
            {t.groups.newLink}
          </Button>
        )}
        {(invites.data?.length ?? 0) > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">{t.groups.activeLinks(invites.data?.length ?? 0)}</p>
            <ul className="space-y-1.5 text-sm text-muted">
              {invites.data?.map((invite) => (
                <li key={invite.uuid} className="flex items-center justify-between gap-3">
                  <span>{t.groups.expires(date(invite.expires_at))}</span>
                  <button
                    type="button"
                    onClick={() => revoke.mutate(invite.uuid)}
                    className="font-semibold text-berry hover:underline"
                  >
                    {t.groups.revoke}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <FormError message={error} />
        <hr className="border-line" />
        <ByUsername group={group} />
      </div>
    </section>
  );
}

function GroupSettings({ group }: { group: GroupDetail }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(group.name);
  const [limit, setLimit] = useState(group.member_limit);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => updateGroup(group.uuid, { name: name.trim(), member_limit: limit }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <section aria-labelledby="group-settings">
      <h2 id="group-settings" className="mb-3 font-display text-lg font-semibold">
        {t.groups.settings}
      </h2>
      <form
        className="space-y-3 rounded-2xl border border-line bg-surface px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <Field label={t.groups.name} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required />
        <Field
          label={t.groups.limit}
          type="number"
          inputMode="numeric"
          min={Math.max(2, group.member_count)}
          max={100}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          required
        />
        <FormError message={error} />
        <Button type="submit" variant="secondary" loading={save.isPending}>
          {t.groups.save}
        </Button>
      </form>
    </section>
  );
}

function Leave({ group, onLeft }: { group: GroupDetail; onLeft: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const me = group.members.find((member) => member.is_me);
  const leave = useMutation({
    mutationFn: () => removeMember(group.uuid, me?.uuid ?? ""),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      onLeft();
    },
    onError: (err) => setError(errorMessage(err)),
  });
  if (!me) return null;

  return (
    <section>
      {confirming ? (
        <div className="space-y-3 rounded-2xl border border-berry/40 bg-surface px-5 py-4">
          <p>{t.groups.leaveConfirm}</p>
          <div className="flex gap-2">
            <Button variant="danger" loading={leave.isPending} onClick={() => leave.mutate()}>
              <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
              {t.groups.leave}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
          </div>
          <FormError message={error} />
        </div>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
          {t.groups.leave}
        </Button>
      )}
    </section>
  );
}
