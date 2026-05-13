"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { haptic } from "@/lib/utils";

type Mode = "password" | "verify" | "set-password";

export default function AuthSheet({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = createClient();

  function clearMessages() {
    setError(null);
    setNotice(null);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    clearMessages();
    haptic("medium");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      const isWrongCreds = err.message.toLowerCase().includes("invalid login") || err.message.toLowerCase().includes("invalid credentials");
      setError(isWrongCreds ? "Wrong email or password. Get a code instead?" : err.message);
      haptic("heavy");
    } else {
      haptic("light");
      window.location.href = "/app/pulse";
    }
  }

  async function sendCode() {
    if (!email) {
      setError("Enter your email first");
      return;
    }
    setLoading(true);
    clearMessages();
    haptic("medium");
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      haptic("heavy");
    } else {
      haptic("light");
      setNotice(`Code sent to ${email}.`);
      setMode("verify");
      setCode("");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code || code.length < 6) return;
    setLoading(true);
    clearMessages();
    haptic("medium");
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      haptic("heavy");
    } else {
      haptic("light");
      setNotice("Signed in. Set a password for faster sign-in next time?");
      setMode("set-password");
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    clearMessages();
    haptic("medium");
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (err) {
      setError(err.message);
      haptic("heavy");
    } else {
      haptic("light");
      window.location.href = "/app/pulse";
    }
  }

  function skipPasswordSetup() {
    haptic("light");
    window.location.href = "/app/pulse";
  }

  function backToPassword() {
    clearMessages();
    setMode("password");
    setCode("");
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
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-ink-600" />
              </div>

              <div className="px-6 pb-8 pt-4">
                {mode === "password" && (
                  <>
                    <h2 className="font-display text-2xl font-black tracking-tight">
                      Sign in.
                    </h2>
                    <p className="mt-1 text-sm text-ink-400">
                      Have a password? Use it. First time? Get a code by email.
                    </p>

                    <form onSubmit={signIn} className="mt-6 space-y-3">
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
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password (skip if first time)"
                        className="w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-4 text-[17px] text-ink-100 placeholder:text-ink-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />

                      {error && (
                        <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className="w-full rounded-xl bg-brand py-4 font-display text-[17px] font-bold text-ink-900 shadow-glow transition disabled:opacity-50 active:scale-[0.98]"
                      >
                        {loading ? "Signing in..." : "Sign in with password"}
                      </button>
                    </form>

                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-ink-700" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">or</span>
                      <div className="h-px flex-1 bg-ink-700" />
                    </div>

                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={loading || !email}
                      className="w-full rounded-xl border border-brand/40 bg-brand/10 py-4 font-display text-[15px] font-bold text-brand transition active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? "Sending..." : "Email me a code →"}
                    </button>
                    <p className="mt-2 text-center text-[11px] text-ink-500">
                      First time, or forgot your password? Use this.
                    </p>
                  </>
                )}

                {mode === "verify" && (
                  <>
                    <h2 className="font-display text-2xl font-black tracking-tight">
                      Check your email.
                    </h2>
                    <p className="mt-1 text-sm text-ink-400">
                      {notice ?? `Code sent to ${email}.`}
                    </p>

                    <form onSubmit={verifyCode} className="mt-6 space-y-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={10}
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="Code from email"
                        className="w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-4 text-center font-mono text-[22px] font-bold tracking-[0.3em] text-ink-100 placeholder:text-ink-600 placeholder:tracking-normal placeholder:text-[15px] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />

                      {error && (
                        <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || code.length < 6}
                        className="w-full rounded-xl bg-brand py-4 font-display text-[17px] font-bold text-ink-900 shadow-glow transition disabled:opacity-50 active:scale-[0.98]"
                      >
                        {loading ? "Verifying..." : "Sign in"}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={backToPassword}
                      disabled={loading}
                      className="mt-3 w-full rounded-xl border border-ink-700 bg-ink-900/50 py-3 font-mono text-[12px] font-bold uppercase tracking-wider text-ink-300 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      Use password instead
                    </button>
                  </>
                )}

                {mode === "set-password" && (
                  <>
                    <h2 className="font-display text-2xl font-black tracking-tight">
                      You&apos;re in. Set a password?
                    </h2>
                    <p className="mt-1 text-sm text-ink-400">
                      Skip the email next time. Your phone will save & autofill it on sign-in.
                    </p>

                    <form onSubmit={savePassword} className="mt-6 space-y-3">
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="new password (8+ chars)"
                        className="w-full rounded-xl border border-ink-700 bg-ink-900 px-4 py-4 text-[17px] text-ink-100 placeholder:text-ink-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />

                      {error && (
                        <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || newPassword.length < 8}
                        className="w-full rounded-xl bg-brand py-4 font-display text-[17px] font-bold text-ink-900 shadow-glow transition disabled:opacity-50 active:scale-[0.98]"
                      >
                        {loading ? "Saving..." : "Save & continue"}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={skipPasswordSetup}
                      disabled={loading}
                      className="mt-3 w-full rounded-xl border border-ink-700 bg-ink-900/50 py-3 font-mono text-[12px] font-bold uppercase tracking-wider text-ink-300 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      Skip for now
                    </button>
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