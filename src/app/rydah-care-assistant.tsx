"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantResponse = {
  reply?: string;
  mode?: "ai" | "guided";
  error?: string;
};

const quickPrompts = [
  "I need a provider",
  "How does payment work?",
  "How do I verify the provider?",
  "My profession is not listed",
];

export default function RydahCareAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hi — I’m Rydah Care. I can help you find a provider, post a job, understand payments, use the arrival safety check or reach support.",
    },
  ]);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"ai" | "guided" | null>(null);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages.slice(-6);
    const nextMessages = [...messages, { role: "user" as const, content: message }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const result = (await response.json().catch(() => ({}))) as AssistantResponse;
      const reply = result.reply || result.error || "I couldn’t answer that just now. Please open Support for help.";
      setMode(result.mode || "guided");
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "I’m having trouble connecting. You can still use Find a Provider, Post a Job, or open Support." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-24 right-5 z-[90] flex items-center gap-3 rounded-full border border-[#D4AF37]/40 bg-[#111]/95 px-5 py-3 font-black text-white shadow-2xl backdrop-blur transition hover:border-[#D4AF37]"
        aria-expanded={open}
        aria-controls="rydah-care-panel"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] text-lg text-black">R</span>
        <span className="hidden sm:inline">Rydah Care</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </button>

      {open && (
        <section id="rydah-care-panel" className="fixed bottom-40 right-4 z-[90] flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0D0D0D] shadow-2xl sm:right-5">
          <div className="border-b border-white/10 bg-gradient-to-r from-[#17130a] to-[#101010] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">RYDAH CARE</p>
                <h2 className="mt-1 text-xl font-black text-white">Customer Care Assistant</h2>
                <p className="mt-1 text-xs text-zinc-500">{mode === "ai" ? "AI-powered response" : "Secure guided help • AI-ready"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-3 py-2 text-zinc-300" aria-label="Close assistant">✕</button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#D4AF37] text-black" : "border border-white/10 bg-[#171717] text-zinc-200"}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-[#171717] px-4 py-3 text-sm text-zinc-500">Rydah Care is checking…</div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {quickPrompts.map((prompt) => (
                <button key={prompt} disabled={sending} type="button" onClick={() => void ask(prompt)} className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-40">{prompt}</button>
              ))}
            </div>
            <form onSubmit={submit} className="flex gap-2">
              <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={800} placeholder="Ask Rydah Care…" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#171717] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600" />
              <button disabled={sending || !input.trim()} className="rounded-2xl bg-[#D4AF37] px-4 py-3 text-sm font-black text-black disabled:opacity-40">Send</button>
            </form>
            <p className="mt-3 text-[11px] leading-4 text-zinc-600">Never send passwords, OTPs, card PINs, NINs or other secrets in chat. For account-specific review, use Support.</p>
          </div>
        </section>
      )}
    </>
  );
}
