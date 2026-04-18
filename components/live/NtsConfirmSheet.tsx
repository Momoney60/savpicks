"use client";

import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/utils";

export default function NtsConfirmSheet({
  open,
  teamId,
  teamName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  teamId: string;
  teamName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            className="fixed inset-x-0 bottom-0 z-[81] mx-auto max-w-md rounded-t-3xl border-t border-ink-700 bg-ink-850 pb-safe"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-ink-600" />
            </div>
            <div className="px-6 pt-4 pb-8">
              <div className="text-center">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-live">
                  ⚡ Lock Next Goal
                </p>
                <h2 className="mt-3 font-display text-[26px] font-black leading-tight tracking-tight text-ink-100">
                  Lock <span className="text-brand">{teamName}</span>?
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
                  Once locked, you can&apos;t change it. You&apos;ll get a new Next Goal market after the next goal is scored.
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    haptic("light");
                    onCancel();
                  }}
                  className="flex-1 rounded-xl border border-ink-700 bg-ink-800 py-3.5 font-display text-[14px] font-bold text-ink-200 transition active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    haptic("heavy");
                    onConfirm();
                  }}
                  className="flex-1 rounded-xl bg-brand py-3.5 font-display text-[14px] font-black text-ink-900 shadow-glow transition active:scale-[0.98]"
                >
                  Lock it in
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
