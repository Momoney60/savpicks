import { cn } from "@/lib/utils";

export function RinkStripes({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-[2px]", className)}>
      <div className="h-[2px] bg-rink-blue/80" />
      <div className="h-[1px] bg-rink-red/90" />
      <div className="h-[2px] bg-rink-blue/80" />
    </div>
  );
}

export function GoalLine({ className }: { className?: string }) {
  return <div className={cn("h-[1px] bg-rink-red/70", className)} />;
}

export function BlueLine({ className }: { className?: string }) {
  return <div className={cn("h-[2px] bg-rink-blue/80", className)} />;
}
