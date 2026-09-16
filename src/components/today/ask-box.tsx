"use client";
import { useState, type FormEvent } from "react";
import { SendHorizonal, Sparkles } from "lucide-react";
import { adapters } from "@/adapters";
import { useAsync } from "@/hooks/use-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/common/section";

interface Turn {
  question: string;
  answer?: string;
}

export function AskBox({ locationId, date }: { locationId: string; date: string }) {
  const { data: suggestions } = useAsync(() => adapters.narrator.suggestedQuestions(locationId), [locationId]);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setQ("");
    setTurns((t) => [...t, { question: text }]);
    const res = await adapters.narrator.ask(locationId, date, text);
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer: res.answer } : x)));
    setBusy(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(q);
  };

  const placeholder = suggestions?.length ? `Try “${suggestions[0]}”` : "Ask about this day";

  return (
    <Section title="Ask about this day" description="Answers come from the same numbers as the brief.">
      <div className="flex flex-col gap-3">
        {turns.length ? (
          <ul className="flex flex-col gap-3">
            {turns.map((t, i) => (
              <li key={i} className="flex flex-col gap-2">
                <div className="bg-muted ml-auto max-w-[92%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm">{t.question}</div>
                <div className="bg-accent/60 mr-auto flex max-w-[92%] gap-2 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed">
                  <Sparkles className="text-primary mt-0.5 size-4 shrink-0" />
                  {t.answer ? (
                    <span>{t.answer}</span>
                  ) : (
                    <span className="flex w-56 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3.5 w-5/6" />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={submit} className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Question" disabled={busy} />
          <Button type="submit" size="icon" className="size-10 shrink-0 md:size-9" disabled={busy || !q.trim()} aria-label="Ask">
            <SendHorizonal />
          </Button>
        </form>
        {suggestions?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                disabled={busy}
                className="bg-muted hover:bg-muted/70 cursor-pointer rounded-full px-2.5 py-1 text-xs disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Section>
  );
}
