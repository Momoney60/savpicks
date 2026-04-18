"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/utils";

export default function CollapsibleSection({
  title,
  subtitle,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  count?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-3xl border border-ink-700/70 bg-ink-850">
      <button
        onClick={() => {
          haptic("light");
          setOpen(!open);
        }}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition active:bg-ink-800/50"
      >
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold text-ink-100">{title}</div>
          {subtitle && (
            <div className="mt-0.5 truncate text-[11px] text-ink-500">{subtitle}</div>
          )}
        </div>
        <div className="flex flex-none items-center gap-3">
          {count && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
              {count}
            </span>
          )}
          <motion.svg
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="h-4 w-4 text-ink-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </motion.svg>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-ink-700/50 bg-ink-900/30 p-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
