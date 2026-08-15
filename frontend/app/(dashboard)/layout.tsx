"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, ShieldAlert, X } from "lucide-react";
import NotificationBell from "@/components/notifications/notification-bell";
import ReviewCountBadge from "@/components/reservations/review-count-badge";
import ThemeToggle from "@/components/shared/theme-toggle";
import { apiFetch, PLATFORM_ADMIN_SESSION_KEY } from "@/lib/api";
import { PermissionProvider, usePermission } from "@/lib/permission-context";

interface PlatformAdminSession {
  token: string;
  organizationId: string;
  organizationName: string;
  reason: string;
}

function readPlatformAdminSession(): PlatformAdminSession | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(PLATFORM_ADMIN_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PlatformAdminSession;
  } catch {
    return null;
  }
}

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Properties", href: "/properties" },
  { name: "Reservations", href: "/reservations" },
  { name: "Review", href: "/reservations/review" },
  { name: "Calendar", href: "/calendar" },
  { name: "Guests", href: "/guests" },
  { name: "Messages", href: "/messages" },
  { name: "Cleaning", href: "/cleaning" },
  { name: "Maintenance", href: "/maintenance" },
  { name: "Reports", href: "/reports" },
  { name: "Inventory", href: "/inventory" },
  { name: "Integrations", href: "/integrations" },
  { name: "Status Center", href: "/status" },
  { name: "Approvals", href: "/approvals" },
  { name: "Team", href: "/team" },
  { name: "Audit Log", href: "/audit-log" },
  { name: "AI Assistant", href: "/ai" },
];

/**
 * Phase 7.5 — PermissionProvider now owns the single
 * GET /api/organization/me call this layout used to make standalone
 * (including the "not a member yet -> onboarding" and "platform admin
 * session expired -> /admin" redirects) — see lib/permission-context.tsx.
 * This inner component just consumes its `ready`/`isPlatformAdminViewing`
 * state instead of tracking its own copy.
 */
function DashboardLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [platformAdminSession, setPlatformAdminSession] =
    useState<PlatformAdminSession | null>(null);
  const { ready, isPlatformAdmin } = usePermission();

  useEffect(() => {
    setPlatformAdminSession(readPlatformAdminSession());
  }, []);

  async function exitPlatformAdminView() {
    const session = readPlatformAdminSession();

    if (session) {
      await apiFetch(
        `/api/platform-admin/organizations/${session.organizationId}/exit`,
        { method: "POST" }
      ).catch(() => {
        // Best-effort — the local session is cleared regardless, same
        // posture as every other logout-adjacent action in this app.
      });
    }

    window.sessionStorage.removeItem(PLATFORM_ADMIN_SESSION_KEY);
    router.push("/admin");
  }

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
            className={`mt-1 flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-gradient-to-r from-indigo-500/90 to-violet-500/90 text-white shadow-lg shadow-indigo-950/30"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.name}
            {item.href === "/reservations/review" && <ReviewCountBadge />}
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

      {/* Only shown for accounts holding platform-admin access (see
          usePermission's isPlatformAdmin) — /admin has no other
          discoverable entry point from this shell, which was
          confusing enough in practice to fix. */}
      {isPlatformAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-violet-300 transition hover:bg-white/10 hover:text-violet-200"
        >
          <ShieldAlert size={16} className="shrink-0" />
          Platform Admin
        </Link>
      )}
    </>
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="glass-sidebar fixed inset-y-0 left-0 z-30 hidden h-screen w-64 flex-col border-r border-sidebar-border lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-6">
          <Link
            href="/dashboard"
            className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-xl font-bold tracking-tight text-transparent"
          >
            Hostly PMS Pro
          </Link>
        </div>

        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {navLinks()}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <ThemeToggle />
        </div>
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
            className="glass-sidebar fixed inset-y-0 left-0 flex h-screen w-72 flex-col border-r border-sidebar-border shadow-xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-6">
              <Link
                href="/dashboard"
                className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-xl font-bold tracking-tight text-transparent"
                onClick={() => setMobileNavOpen(false)}
              >
                Hostly PMS Pro
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

            <div className="shrink-0 border-t border-white/10 p-4">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="lg:pl-64">
        <header className="glass-topbar sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              className="-ml-2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu size={22} />
            </button>

            <div>
              <p className="text-sm font-semibold text-foreground">Hostly PMS Pro</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Property Management System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        {/* Persistent, unmissable — never a small dismissible toast.
            Rendered from local sessionStorage state (populated by the
            enter-organization flow in app/admin), but the backend is
            the actual authority: every request while this is active
            is independently verified server-side (see
            organization.middleware.ts's resolvePlatformAdminOverride)
            and read-only-enforced regardless of what this banner
            shows. */}
        {platformAdminSession && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-6 py-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex items-center gap-2 text-sm">
              <ShieldAlert size={18} className="shrink-0" />
              <span>
                <strong>Viewing as Platform Administrator</strong> —{" "}
                {platformAdminSession.organizationName}. Reason: &quot;
                {platformAdminSession.reason}&quot;. Read-only.
              </span>
            </div>
            <button
              onClick={exitPlatformAdminView}
              className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-500/10"
            >
              Exit organization view
            </button>
          </div>
        )}

        <main className="bg-background p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <PermissionProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </PermissionProvider>
  );
}
