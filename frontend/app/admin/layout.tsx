"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const navItems = [
  { name: "Platform Overview", href: "/admin" },
  { name: "Organizations", href: "/admin/organizations" },
  { name: "Calendar", href: "/admin/calendar" },
  { name: "Reports", href: "/admin/reports" },
  { name: "Platform Audit Log", href: "/admin/audit-log" },
];

/**
 * A wholly separate route tree from (dashboard) — a normal
 * organization user must never even see this navigation exist, not
 * just have its actions disabled. Gated by actually calling a
 * platform-admin-only endpoint (GET /api/platform-admin/stats) and
 * redirecting away on a 403, mirroring how (dashboard)/layout.tsx
 * gates on GET /api/organization/me — the backend is always the real
 * authority, this is just the UX redirect.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkPlatformAdmin() {
      try {
        await apiFetch("/api/platform-admin/stats");
        if (!cancelled) setChecked(true);
      } catch {
        if (!cancelled) router.replace("/dashboard");
      }
    }

    checkPlatformAdmin();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  if (!checked) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Verifying platform access...</p>
      </div>
    );
  }

  /*
   * Phase 7.6 — the Super Admin section keeps a permanently dark
   * "platform" identity (the `dark` class forced here scopes every
   * design token underneath it to the dark palette) independent of
   * the org dashboard's light/dark toggle. This is a deliberate,
   * common pattern for admin/ops consoles, not an oversight — see
   * the checkpoint report for the full rationale.
   */
  return (
    <div className="dark min-h-screen bg-background">
      <aside className="glass-sidebar fixed inset-y-0 left-0 z-30 hidden h-screen w-64 flex-col border-r border-sidebar-border lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-6">
          <Link href="/admin" className="text-xl font-bold tracking-tight text-white">
            Hostly PMS Pro <span className="text-violet-400">Platform</span>
          </Link>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-violet-400">
            Platform Administration
          </p>

          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mt-1 flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-gradient-to-r from-indigo-500/90 to-violet-500/90 text-white shadow-lg shadow-indigo-950/30"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          ))}

          <div className="my-5 border-t border-white/10" />

          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ← Back to my organization
          </Link>
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="glass-topbar sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border px-6">
          <div>
            <p className="text-sm font-semibold text-foreground">Platform Administration</p>
            <p className="text-xs text-violet-400">Super Admin — cross-organization view</p>
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
