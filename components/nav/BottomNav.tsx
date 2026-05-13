"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Trophy, Medal, BookOpen } from "lucide-react";
import { cn, haptic } from "@/lib/utils";

const tabs = [
  { href: "/app/live", label: "Props", icon: Zap },
  { href: "/app/bracket", label: "Bracket", icon: Trophy },
  { href: "/app/pulse", label: "Standings", icon: Medal },
  { href: "/app/rules", label: "Rules", icon: BookOpen },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700/60 bg-ink-900/95 backdrop-blur-xl pb-safe">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => haptic("light")}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
            >
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-colors",
                  active ? "text-brand" : "text-ink-500"
                )}
                strokeWidth={active ? 2.4 : 1.9}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wide transition-colors",
                  active ? "text-brand" : "text-ink-500"
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