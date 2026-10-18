"use client";

import { useMutation } from "@tanstack/react-query";
import { SendHorizontal, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AnswerText, Suggestions } from "@/components/assistant/AnswerText";
import { useI18n } from "@/i18n/I18nProvider";
import { askAssistant } from "@/services/assistant";
import type { AssistantAnswer } from "@/types/api";

type Said =
  | { from: "student"; text: string }
  | { from: "assistant"; answer: AssistantAnswer }
  | { from: "error" };
type Message = Said & { id: number };

export default function AssistantPage() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  const add = (said: Said) => {
    const id = nextId.current++;
    setMessages((list) => [...list, { ...said, id }]);
  };

  const ask = useMutation({
    mutationFn: askAssistant,
    onSuccess: (answer) => add({ from: "assistant", answer }),
    onError: () => add({ from: "error" }),
  });

  const send = (question: string) => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    add({ from: "student", text });
    setDraft("");
    ask.mutate(text);
  };

  // Keep the newest message in view.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, ask.isPending]);

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-2xl font-semibold">{t.assistant.title}</h1>
        <p className="mt-1 max-w-prose text-[15px] text-muted">{t.assistant.intro}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-pine">
          <Sparkles className="size-4" aria-hidden />
          {t.assistant.local}
        </p>
      </header>

      {messages.length === 0 && <Suggestions onAsk={send} />}

      <ol className="space-y-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.li
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={message.from === "student" ? "flex justify-end" : "flex justify-start"}
            >
              {message.from === "student" ? (
                <p className="max-w-[85%] rounded-2xl rounded-ee-md bg-pine px-4 py-2.5 text-[15px] text-on-pine">
                  <span className="sr-only">{t.assistant.you}: </span>
                  {message.text}
                </p>
              ) : (
                <div className="max-w-[90%] rounded-2xl rounded-es-md border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed">
                  {message.from === "assistant" ? (
                    <AnswerText answer={message.answer} onAsk={send} />
                  ) : (
                    <p className="text-berry">{t.assistant.failed}</p>
                  )}
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        {ask.isPending && (
          <li className="flex justify-start">
            <p className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] text-muted">
              <span className="inline-flex gap-1" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted" />
              </span>
              <span className="sr-only">{t.assistant.thinking}</span>
            </p>
          </li>
        )}
      </ol>
      <div ref={bottom} />

      {/* Above the phone tab bar; at the bottom of the page on large screens. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
        className="fixed inset-x-0 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-paper/90 px-4 py-3 backdrop-blur lg:bottom-0 lg:start-[240px]"
      >
        <div className="mx-auto flex max-w-3xl gap-2 sm:px-4">
          <label htmlFor="assistant-question" className="sr-only">
            {t.assistant.placeholder}
          </label>
          <input
            id="assistant-question"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t.assistant.placeholder}
            maxLength={300}
            autoComplete="off"
            dir="auto"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-pine"
          />
          <button
            type="submit"
            disabled={!draft.trim() || ask.isPending}
            aria-label={t.assistant.send}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-pine text-on-pine transition-[background-color,transform] hover:bg-pine-dark active:scale-95 disabled:opacity-50"
          >
            <SendHorizontal className="size-5 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
      </form>
    </>
  );
}
