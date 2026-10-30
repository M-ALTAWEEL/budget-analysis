"use client";

import { Mic, Wand2 } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { quickAdd, type QuickAdd } from "@/services/expenses";

// The browser's speech recognition (Chrome, Edge, Safari); missing in Firefox.
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const noSubscription = () => () => {};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SPEECH_LANG: Record<string, string> = { en: "en-US", ar: "ar-SA", tr: "tr-TR" };

/** Feature F9: say or type the expense in one sentence; the form below is filled in. */
export function QuickAddBar({ onFound }: { onFound: (found: QuickAdd) => void }) {
  const { t, locale } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Known only in the browser: false while rendering on the server, then the real answer.
  const canListen = useSyncExternalStore(
    noSubscription,
    () => recognitionClass() !== null,
    () => false,
  );
  const recognition = useRef<Recognition | null>(null);


  async function fill(sentence = text) {
    if (!sentence.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const found = await quickAdd(sentence.trim());
      if (found.amount === null) setMessage(t.quickAdd.nothing);
      onFound(found);
    } catch {
      setMessage(t.quickAdd.nothing);
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    const Speech = recognitionClass();
    if (!Speech) return setMessage(t.quickAdd.noMic);
    if (listening) return recognition.current?.stop();
    const r = new Speech();
    r.lang = SPEECH_LANG[locale] ?? "en-US";
    r.interimResults = false;
    r.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript ?? "";
      setText(said);
      void fill(said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  }

  return (
    <div className="rounded-xl border border-dashed border-pine/50 bg-pine-soft/40 p-3">
      <label htmlFor="quick-add" className="mb-1.5 block text-sm font-semibold">
        {t.quickAdd.label}
      </label>
      <div className="flex gap-2">
        <input
          id="quick-add"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void fill();
            }
          }}
          placeholder={listening ? t.quickAdd.listening : t.quickAdd.placeholder}
          maxLength={300}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[15px]"
        />
        {canListen && (
          <button
            type="button"
            onClick={listen}
            aria-label={t.quickAdd.listen}
            title={t.quickAdd.listen}
            className={`grid size-10 shrink-0 place-items-center rounded-lg border ${listening ? "animate-pulse border-berry bg-berry text-white" : "border-line bg-surface hover:bg-ink/5"}`}
          >
            <Mic className="size-5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => void fill()}
          disabled={busy || !text.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-pine px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Wand2 className="size-4" aria-hidden />
          {t.quickAdd.fill}
        </button>
      </div>
      {message && <p className="mt-1.5 text-sm text-berry">{message}</p>}
    </div>
  );
}
