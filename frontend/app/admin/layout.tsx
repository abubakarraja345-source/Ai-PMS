"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const navItems = [
  { name: "Platform Overview", href: "/admin" },
  { name: "Organizations", href: "/admin/organizations" },
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-400">Verifying platform access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-64 flex-col border-r border-violet-900/40 bg-slate-950 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-6">
          <Link href="/admin" className="text-xl font-bold tracking-tight text-white">
            Hostly <span className="text-violet-400">Platform</span>
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
                  ? "bg-violet-500/20 text-white"
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-violet-900/40 bg-slate-950/95 px-6 backdrop-blur">
          <div>
            <p className="text-sm font-semibold text-white">Platform Administration</p>
            <p className="text-xs text-violet-400">Super Admin — cross-organization view</p>
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
