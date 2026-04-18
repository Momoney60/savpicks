"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { haptic } from "@/lib/utils";
import ChatSheet from "./ChatSheet";

export default function ChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          haptic("medium");
          setOpen(true);
        }}
        aria-label="Open chat"
        className="fixed bottom-20 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-ink-900 shadow-glow transition active:scale-95"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <AnimatePresence>
        {open && <ChatSheet onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
