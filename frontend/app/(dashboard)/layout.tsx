"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, ShieldAlert, X } from "lucide-react";
import NotificationBell from "@/components/notifications/notification-bell";
import ReviewCountBadge from "@/components/reservations/review-count-badge";
import { apiFetch, PLATFORM_ADMIN_SESSION_KEY } from "@/lib/api";

/**
 * requireOrganization's exact 403 message (backend/src/middleware/
 * organization.middleware.ts) — matched literally rather than just
 * checking "any error" because this layout needs to tell "no
 * organization yet" apart from a transient/network failure, unlike
 * the onboarding page's own check where any failure safely falls
 * through to showing the create-workspace form either way.
 */
const NOT_A_MEMBER_MESSAGE = "User is not a member of an organization";

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

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [orgCheckReady, setOrgCheckReady] = useState(false);
  const [platformAdminSession, setPlatformAdminSession] =
    useState<PlatformAdminSession | null>(null);

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

  // The backend (never the client) resolves organization membership —
  // proxy.ts can only gate on authentication (the anon Postgres role
  // has no table grants), so this is the actual enforcement point for
  // "authenticated but no organization yet" across every dashboard
  // route. A user who fails this check is sent to onboarding instead
  // of ever seeing dashboard content.
  useEffect(() => {
    let cancelled = false;

    async function checkOrganization() {
      try {
        await apiFetch("/api/organization/me");

        if (!cancelled) {
          setOrgCheckReady(true);
        }
      } catch (err) {
        if (cancelled) return;

        if (
          err instanceof Error &&
          err.message === NOT_A_MEMBER_MESSAGE
        ) {
          // A platform admin has no real organization_members row —
          // if we get this specific 403 while a platform-admin
          // viewing session was active, the 15-minute session simply
          // expired (or a request raced its expiry), not "this user
          // genuinely needs onboarding." Send them back to the admin
          // area to re-enter rather than into the onboarding flow.
          if (readPlatformAdminSession()) {
            window.sessionStorage.removeItem(PLATFORM_ADMIN_SESSION_KEY);
            router.replace("/admin");
            return;
          }

          router.replace("/onboarding");
          return;
        }

        // Any other failure (network hiccup, transient auth refresh)
        // shouldn't trap the user on a blank screen — render normally
        // and let the page's own data calls surface a real error if
        // something is genuinely wrong.
        setOrgCheckReady(true);
      }
    }

    checkOrganization();

    return () => {
      cancelled = true;
    };
  }, [router]);

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
                ? "bg-white/10 text-white"
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
    </>
  );

  if (!orgCheckReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

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

        {/* Persistent, unmissable — never a small dismissible toast.
            Rendered from local sessionStorage state (populated by the
            enter-organization flow in app/admin), but the backend is
            the actual authority: every request while this is active
            is independently verified server-side (see
            organization.middleware.ts's resolvePlatformAdminOverride)
            and read-only-enforced regardless of what this banner
            shows. */}
        {platformAdminSession && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-6 py-3 text-amber-900">
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
              className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              Exit organization view
            </button>
          </div>
        )}

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
