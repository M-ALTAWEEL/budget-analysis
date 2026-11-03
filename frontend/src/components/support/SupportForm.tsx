"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import type { SupportInput, SupportTopic } from "@/types/api";

export const TOPICS: SupportTopic[] = ["problem", "idea", "question", "account", "other"];

/** Topic, subject and message: the same form signed in (Help page) and signed out (Contact). */
export function SupportForm({
  onSend,
  sending,
  error,
  extra,
}: {
  onSend: (input: SupportInput) => Promise<boolean>;
  sending: boolean;
  error: string | null;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [topic, setTopic] = useState<SupportTopic>("problem");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setProblem(null);
    if (subject.trim().length < 3) return setProblem(t.support.needSubject);
    if (message.trim().length < 10) return setProblem(t.support.tooShort);
    const platform = `web ${process.env.NEXT_PUBLIC_COMMIT ?? ""}`.trim();
    if (await onSend({ topic, subject: subject.trim(), message: message.trim(), platform })) {
      setSubject("");
      setMessage("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {extra}
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{t.support.topic}</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {TOPICS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={topic === value}
              onClick={() => setTopic(value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                topic === value ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:border-ink/30"
              }`}
            >
              {t.support.topics[value]}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label={t.support.subject} placeholder={t.support.subjectPlaceholder} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} required />
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{t.support.message}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.support.messagePlaceholder}
          maxLength={4000}
          rows={5}
          required
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] focus:border-pine focus:outline-none"
        />
      </label>
      <FormError message={problem ?? error} />
      <Button type="submit" loading={sending}>
        {t.support.send}
      </Button>
    </form>
  );
}
