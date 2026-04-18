"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haptic, formatRelativeTime } from "@/lib/utils";

type ChatMessage = {
  id: string;
  user_id: string;
  body: string;
  room: string;
  created_at: string;
  gamertag?: string;
};

export default function ChatSheet({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    // Load initial messages + subscribe
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data } = await supabase
        .from("chat_messages")
        .select("id, user_id, body, room, created_at, profiles(gamertag)")
        .eq("room", "global")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        const shaped: ChatMessage[] = data
          .map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            body: m.body,
            room: m.room,
            created_at: m.created_at,
            gamertag: m.profiles?.gamertag,
          }))
          .reverse();
        setMessages(shaped);
      }
    })();

    const channel = supabase
      .channel("chat:global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: "room=eq.global" },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("gamertag")
            .eq("id", (payload.new as any).user_id)
            .single();
          setMessages((prev) => [
            ...prev,
            { ...(payload.new as any), gamertag: profile?.gamertag },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!input.trim() || sending || !userId) return;
    setSending(true);
    haptic("light");
    const body = input.trim().slice(0, 500);
    setInput("");

    await supabase.from("chat_messages").insert({
      user_id: userId,
      body,
      room: "global",
    });
    setSending(false);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120) onClose();
        }}
        className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-3xl border-t border-ink-700 bg-ink-850"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-ink-600" />
        </div>

        <div className="flex items-center justify-between border-b border-ink-700 px-5 pb-3">
          <div>
            <h2 className="font-display text-lg font-bold">The Rail</h2>
            <p className="text-xs text-ink-400">Pool chat · {messages.length} messages</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-ink-400 hover:bg-ink-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-5xl">🤐</div>
              <p className="mt-3 text-sm text-ink-400">Nobody&apos;s talking yet. Start the trash talk.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.user_id === userId ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${m.user_id === userId ? "items-end" : "items-start"} flex flex-col`}>
                  {m.user_id !== userId && (
                    <span className="mb-0.5 px-2 text-[11px] font-semibold text-ink-400">
                      {m.gamertag ?? "—"}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                      m.user_id === userId
                        ? "bg-brand text-ink-900"
                        : "bg-ink-800 text-ink-100"
                    }`}
                  >
                    {m.body}
                  </div>
                  <span className="mt-0.5 px-2 text-[10px] text-ink-500">
                    {formatRelativeTime(m.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-ink-700 bg-ink-850 px-4 py-3 pb-safe">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Say something..."
              maxLength={500}
              className="flex-1 rounded-full border border-ink-700 bg-ink-900 px-4 py-3 text-[15px] text-ink-100 placeholder:text-ink-500 focus:border-brand focus:outline-none"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-ink-900 disabled:opacity-40 active:scale-95"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
