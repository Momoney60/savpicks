import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/nav/BottomNav";
import ChatButton from "@/components/chat/ChatButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <div className="relative min-h-screen bg-ink-900">
      <div className="pb-24">{children}</div>
      <ChatButton />
      <BottomNav />
    </div>
  );
}
