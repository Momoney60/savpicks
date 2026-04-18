"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Trophy, Zap, BookOpen } from "lucide-react";
import { cn, haptic } from "@/lib/utils";

const tabs = [
  { href: "/app/pulse", label: "Pulse", icon: Activity },
  { href: "/app/bracket", label: "Bracket", icon: Trophy },
  { href: "/app/live", label: "Live", icon: Zap },
  { href: "/app/rules", label: "Rules", icon: BookOpen },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-900/90 backdrop-blur-xl pb-safe">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => haptic("light")}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5"
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  active ? "text-brand" : "text-ink-400"
                )}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wide transition-colors",
                  active ? "text-brand" : "text-ink-400"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
