"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/utils";

export default function AuthSheet({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    haptic("medium");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      haptic("heavy");
    } else {
      setSent(true);
      haptic("light");
    }
  }

  return (
    <>
      <button
        onClick={() => {
          haptic("light");
          setOpen(true);
        }}
        className="group relative w-full overflow-hidden rounded-xl bg-brand py-4 font-display text-[17px] font-bold text-ink-900 shadow-glow transition active:scale-[0.98]"
      >
        <span className="relative z-10">Enter the Pool →</span>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setOpen(false);
              }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-ink-700 bg-ink-850 pb-safe"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-ink-600" />
              </div>

              <div className="px-6 pb-8 pt-4">
                {sent ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
                      <svg className="h-7 w-7 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <h2 className="font-display text-xl font-bold">Check your email</h2>
                    <p className="mt-2 text-sm text-ink-300">
                      We sent a magic link to <span className="text-ink-100">{email}</span>. Tap it to enter the pool.
                    </p>
                  </div>
                ) : (
                  <>
                    <h2 className="font-display text-2xl font-black tracking-tight">
                      Welcome back.
                    </h2>
                    <p className="mt-1 text-sm text-ink-400">
                      We&apos;ll send you a magic link. No passwords, no nonsense.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-4 text-[17px] text-ink-100 placeholder:text-ink-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />

                      {error && (
                        <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full rounded-xl bg-brand py-4 font-display text-[17px] font-bold text-ink-900 shadow-glow transition disabled:opacity-50 active:scale-[0.98]"
                      >
                        {loading ? "Sending..." : "Send magic link"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
