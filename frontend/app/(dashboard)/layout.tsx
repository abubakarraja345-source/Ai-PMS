"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import NotificationBell from "@/components/notifications/notification-bell";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Properties", href: "/properties" },
  { name: "Reservations", href: "/reservations" },
  { name: "Calendar", href: "/calendar" },
  { name: "Guests", href: "/guests" },
  { name: "Cleaning", href: "/cleaning" },
  { name: "Maintenance", href: "/maintenance" },
  { name: "Reports", href: "/reports" },
  { name: "Inventory", href: "/inventory" },
  { name: "Integrations", href: "/integrations" },
  { name: "Team", href: "/team" },
  { name: "AI Assistant", href: "/ai" },
];

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Escape-to-close + body scroll lock while the drawer is open,
  // matching the "modal keyboard behavior" the rest of the app's
  // hand-rolled overlays don't yet have — restore focus to the
  // trigger button on close for keyboard users.
  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const triggerButton = menuButtonRef.current;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerButton?.focus();
    };
  }, [mobileNavOpen]);

  const navLinks = (onNavigate?: () => void) => (
    <>
      <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        Workspace
      </p>

      {navItems.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
        onClick={onNavigate}
        className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActive("/settings")
            ? "bg-white/10 text-white"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        Settings
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-64 flex-col border-r border-slate-800 bg-slate-950 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-white"
          >
            AI PMS
          </Link>
        </div>

        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {navLinks()}
        </nav>
      </aside>

      {/* Mobile navigation drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 flex h-screen w-72 flex-col border-r border-slate-800 bg-slate-950 shadow-xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
              <Link
                href="/dashboard"
                className="text-xl font-bold tracking-tight text-white"
                onClick={() => setMobileNavOpen(false)}
              >
                AI PMS
              </Link>

              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-4">
              {navLinks(() => setMobileNavOpen(false))}
            </nav>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              className="-ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            >
              <Menu size={22} />
            </button>

            <div>
              <p className="text-sm font-semibold text-slate-900">AI PMS</p>
              <p className="hidden text-xs text-slate-500 sm:block">
                Property Management System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
