import BottomNav from "@/components/nav/BottomNav";
import GoalTicker from "@/components/GoalTicker";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-900 pb-24">
      <GoalTicker />
      {children}
      <BottomNav />
    </div>
  );
}
