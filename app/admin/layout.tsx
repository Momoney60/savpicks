import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-900">
      <header className="border-b border-ink-700 bg-ink-850">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-loss">
              Admin
            </p>
            <h1 className="font-display text-xl font-black">SavPicks Commissioner</h1>
          </div>
          <nav className="flex gap-1 text-sm">
            <AdminLink href="/admin">Overview</AdminLink>
            <AdminLink href="/admin/users">Users</AdminLink>
            <AdminLink href="/admin/series">Series</AdminLink>
            <AdminLink href="/admin/props">Props</AdminLink>
            <AdminLink href="/admin/adjustments">Adjustments</AdminLink>
            <Link href="/app/pulse" className="ml-4 rounded-lg bg-ink-800 px-3 py-1.5 text-ink-300 hover:bg-ink-700">
              ← App
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
    >
      {children}
    </Link>
  );
}
