"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Properties", href: "/properties" },
    { name: "Reservations", href: "/reservations" },
    { name: "Calendar", href: "/calendar" },
    { name: "Guests", href: "/guests" },
    { name: "Cleaning", href: "/cleaning" },
    { name: "Maintenance", href: "/maintenance" },
    { name: "AI Assistant", href: "/ai" },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800 bg-slate-950 lg:block">
        <div className="flex h-16 items-center border-b border-white/10 px-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-white"
          >
            AI PMS
          </Link>
        </div>

        <nav className="p-4">
          <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            Workspace
          </p>

          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          <div className="my-5 border-t border-white/10" />

          <Link
            href="/settings"
            className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive("/settings")
                ? "bg-white/10 text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main area */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-6 backdrop-blur">
          <div>
            <p className="text-sm font-semibold text-slate-900">AI PMS</p>
            <p className="text-xs text-slate-500">
              Property Management System
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Notifications
            </button>
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}