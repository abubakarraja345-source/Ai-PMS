"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, PLATFORM_ADMIN_SESSION_KEY } from "@/lib/api";

export type PermissionEffect = "allow" | "deny" | "approval";

/**
 * requireOrganization's exact 403 message (backend/src/middleware/
 * organization.middleware.ts) — matched literally so this provider
 * can tell "no organization yet" apart from a transient failure.
 */
const NOT_A_MEMBER_MESSAGE = "User is not a member of an organization";

interface PermissionContextValue {
  ready: boolean;
  organizationId: string | null;
  organizationName: string | null;
  role: string | null;
  roleLabel: string | null;
  permissions: string[];
  permissionEffects: Record<string, PermissionEffect>;
  isPlatformAdminViewing: boolean;
  /** Whether this user holds platform-admin access at all (see
   * /admin) — distinct from isPlatformAdminViewing, which is only
   * true while actively "inside" an Enter-Organization read-only
   * session. Used to show a link into /admin, which otherwise has no
   * discoverable entry point from the regular dashboard. */
  isPlatformAdmin: boolean;
  /** true only for "allow" — the common case ("can I show/enable this
   * button"). Backend still enforces everything independently; this
   * is UX only. */
  can: (action: string) => boolean;
  /** The full effect, including "approval" — lets UI show "submitting
   * this will require approval" before the user even submits. */
  effectOf: (action: string) => PermissionEffect;
  reload: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

/**
 * Phase 7.5 — the ONE place `/api/organization/me` is fetched for the
 * whole dashboard shell (previously (dashboard)/layout.tsx fetched it
 * standalone just for the org-membership redirect check; that logic
 * now lives here too, so there's exactly one request instead of two).
 * `can()`/`effectOf()` are read from the exact same `permissions`/
 * `permissionEffects` arrays the backend's requirePermission
 * middleware and every route computes from — see
 * permissions/service.ts's getEffectivePermissions — so this can
 * never drift out of sync with what's actually enforced server-side.
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<{
    organizationId: string | null;
    organizationName: string | null;
    role: string | null;
    roleLabel: string | null;
    permissions: string[];
    permissionEffects: Record<string, PermissionEffect>;
    isPlatformAdminViewing: boolean;
    isPlatformAdmin: boolean;
  }>({
    organizationId: null,
    organizationName: null,
    role: null,
    roleLabel: null,
    permissions: [],
    permissionEffects: {},
    isPlatformAdminViewing: false,
    isPlatformAdmin: false,
  });

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/organization/me");

      setData({
        organizationId: response.data?.id ?? null,
        organizationName: response.data?.name ?? null,
        role: response.data?.role ?? null,
        roleLabel: response.data?.roleLabel ?? null,
        permissions: response.data?.permissions ?? [],
        permissionEffects: response.data?.permissionEffects ?? {},
        isPlatformAdminViewing: response.data?.isPlatformAdminViewing === true,
        isPlatformAdmin: response.data?.isPlatformAdmin === true,
      });

      setReady(true);
    } catch (err) {
      if (err instanceof Error && err.message === NOT_A_MEMBER_MESSAGE) {
        if (typeof window !== "undefined" && window.sessionStorage.getItem(PLATFORM_ADMIN_SESSION_KEY)) {
          // A platform-admin viewing session expired mid-browse — see
          // (dashboard)/layout.tsx's original comment on this case.
          window.sessionStorage.removeItem(PLATFORM_ADMIN_SESSION_KEY);
          router.replace("/admin");
          return;
        }

        router.replace("/onboarding");
        return;
      }

      // Any other failure (network hiccup, transient auth refresh)
      // shouldn't trap the user on a blank screen.
      setReady(true);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const value: PermissionContextValue = {
    ready,
    ...data,
    can: (action: string) => data.permissionEffects[action] === "allow",
    effectOf: (action: string) => data.permissionEffects[action] ?? "deny",
    reload: load,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission(): PermissionContextValue {
  const ctx = useContext(PermissionContext);

  if (!ctx) {
    throw new Error("usePermission() must be used within a PermissionProvider");
  }

  return ctx;
}
