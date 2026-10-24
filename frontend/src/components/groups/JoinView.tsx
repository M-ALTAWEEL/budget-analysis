"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageLoader } from "@/components/ui/PageLoader";
import { useI18n } from "@/i18n/I18nProvider";
import { useErrorMessage } from "@/lib/errors";
import { savePendingInvite } from "@/lib/pendingInvite";
import { acceptInvite, previewInvite } from "@/services/groups";

/** /join?token=…: who invited you to what, then one button. */
export function JoinView() {
  const { t } = useI18n();
  const { status } = useAuth();
  const token = useSearchParams().get("token") ?? "";

  useEffect(() => {
    if (status === "anonymous" && token) savePendingInvite(token);
  }, [status, token]);

  if (!token) return <Invalid />;
  if (status === "loading") return <PageLoader />;
  if (status === "anonymous") {
    return (
      <Card>
        <p className="text-muted">{t.groups.signInToJoin}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/login" className="inline-flex h-11 items-center rounded-xl bg-pine px-5 font-semibold text-on-pine">
            {t.auth.logIn}
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-5 font-semibold"
          >
            {t.auth.createAccount}
          </Link>
        </div>
      </Card>
    );
  }
  return <Preview token={token} />;
}

function Preview({ token }: { token: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => previewInvite(token),
    retry: false,
  });
  const join = useMutation({
    mutationFn: () => acceptInvite(token),
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      router.replace(`/groups?g=${group.uuid}`);
    },
  });

  if (preview.isPending) return <PageLoader />;
  if (preview.isError) {
    return isAxiosError(preview.error) && preview.error.response?.status === 404 ? (
      <Invalid />
    ) : (
      <Card>
        <FormError message={errorMessage(preview.error)} />
      </Card>
    );
  }
  const p = preview.data;
  const full = p.member_count >= p.member_limit && !p.already_member;

  return (
    <Card>
      <p>{t.groups.joinText(p.group_name, p.member_count, p.member_limit)}</p>
      {p.already_member && <p className="text-sm text-muted">{t.groups.alreadyIn}</p>}
      {full && <p className="text-sm text-berry">{t.groups.full}</p>}
      <FormError
        message={
          join.isError ? errorMessage(join.error, { 403: t.groups.verifyFirst, 404: t.groups.inviteInvalid }) : null
        }
      />
      <Button className="w-full" loading={join.isPending} disabled={full} onClick={() => join.mutate()}>
        {p.already_member ? t.groups.open : t.groups.join}
      </Button>
    </Card>
  );
}

function Invalid() {
  const { t } = useI18n();
  return (
    <Card>
      <p className="text-berry">{t.groups.inviteInvalid}</p>
      <Link href="/groups" className="text-sm font-semibold text-pine hover:underline">
        {t.groups.back}
      </Link>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-3 font-display text-2xl font-semibold">
        <Users className="size-6 text-pine" aria-hidden />
        {t.groups.joinTitle}
      </h1>
      {children}
    </div>
  );
}
