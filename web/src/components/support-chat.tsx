"use client";
import { useEffect, useRef, useState } from "react";
import {
  MessageCircle, X, Send, Loader2, ArrowLeft, CheckCircle2, UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

type ChatMessage = { role: "user" | "assistant"; content: string };
type View = "chat" | "handoff" | "sent";

const GREETING =
  "Hi! I can help with buying, selling, payments and tickets on Darra. What do you need?";

const SUGGESTIONS = [
  "How do I download something I bought?",
  "How do I start selling?",
  "When do sellers get paid?",
];

export function SupportChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  // Handoff form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, view]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setThinking(true);
    setError("");

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the recent turns are sent; the backend caps this anyway.
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "The assistant is unavailable.");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setThinking(false);
    }
  };

  const openHandoff = () => {
    // Pre-fill everything we already know so they type as little as possible.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    setDetails((d) => d || lastUser?.content || "");
    if (user?.full_name) setName((n) => n || user.full_name);
    if (user?.email) setEmail((e) => e || user.email);
    setFormError("");
    setView("handoff");
  };

  const submitHandoff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (name.trim().length < 2) return setFormError("Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFormError("Please enter a valid email.");
    if (details.trim().length < 10) return setFormError("Please describe the problem in a bit more detail.");

    setSending(true);
    try {
      // Include what they already asked, so support isn't starting cold.
      const transcript = messages
        .filter((m) => m.content !== GREETING)
        .map((m) => `${m.role === "user" ? "Them" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: details.trim(),
          source: "chat",
          conversation: transcript,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not send your message.");
      setView("sent");
    } catch (err: any) {
      setFormError(err.message || "Could not send your message.");
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMessages([{ role: "assistant", content: GREETING }]);
    setInput("");
    setError("");
    setName(""); setEmail(""); setDetails(""); setFormError("");
    setView("chat");
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className="fixed bottom-5 right-5 z-1000 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-transform hover:bg-brand-600 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel: z-1000 clears the sticky site header (z-999), and the height
          leaves room for it so on short screens the top of the panel stops
          below the header instead of tucking under it. */}
      {open && (
        <div className="fixed bottom-24 right-5 z-1000 flex h-[min(560px,calc(100dvh-11rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">

          {/* Header */}
          <div className="flex items-center gap-3 bg-brand-950 px-5 py-4">
            {view !== "chat" && (
              <button
                onClick={() => setView("chat")}
                className="text-brand-200 transition-colors hover:text-white"
                aria-label="Back to chat"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">
                {view === "chat" ? "Darra support" : view === "handoff" ? "Talk to a human" : "Message sent"}
              </p>
              <p className="text-xs text-brand-200/70">
                {view === "chat" ? "Answers are AI-generated" : "We reply by email"}
              </p>
            </div>
          </div>

          {/* Chat */}
          {view === "chat" && (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-page px-4 py-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] min-w-0 whitespace-pre-wrap wrap-break-word rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-brand-500 text-white"
                          : "border border-gray-100 bg-white text-gray-800"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}

                {messages.length === 1 && !thinking && (
                  <div className="space-y-2 pt-1">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="block w-full rounded-2xl border border-brand-200 bg-white px-3.5 py-2 text-left text-xs text-brand-600 transition-colors hover:bg-brand-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {thinking && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5 text-sm text-gray-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-xs text-[#b3261e]">
                    {error}
                  </div>
                )}
              </div>

              {/* Handoff prompt */}
              <button
                onClick={openHandoff}
                className="flex items-center justify-center gap-1.5 border-t border-gray-100 bg-white py-2.5 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-50"
              >
                <UserRound className="h-3.5 w-3.5" />
                Didn't help? Talk to a human
              </button>

              {/* Composer */}
              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="flex items-center gap-2 border-t border-gray-100 bg-white p-3"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  maxLength={1000}
                  className="h-10 flex-1 rounded-full border border-gray-200 bg-white px-4 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-300"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || thinking}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

          {/* Handoff form */}
          {view === "handoff" && (
            <form onSubmit={submitHandoff} className="flex-1 space-y-3 overflow-y-auto bg-page px-4 py-4">
              <p className="text-xs leading-relaxed text-gray-600">
                Leave your details and we'll email you back. Your chat so far is
                included so you don't have to explain twice.
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">What do you need help with?</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  placeholder="Tell us what happened..."
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-300"
                />
              </div>

              {formError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-[#b3261e]">{formError}</p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {sending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>) : "Send message"}
              </button>
            </form>
          )}

          {/* Sent */}
          {view === "sent" && (
            <div className="flex flex-1 flex-col items-center justify-center bg-page px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EBFBF0]">
                <CheckCircle2 className="h-7 w-7 text-[#00B42A]" />
              </div>
              <p className="mb-1 font-semibold text-ink">Message sent</p>
              <p className="mb-6 text-sm text-gray-600">
                We'll reply to <span className="font-medium text-ink">{email}</span> as
                soon as we can.
              </p>
              <button
                onClick={reset}
                className="rounded-full border border-brand-500 px-5 py-2 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-500 hover:text-white"
              >
                Start a new chat
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
