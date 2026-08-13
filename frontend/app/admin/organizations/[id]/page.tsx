"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, PLATFORM_ADMIN_SESSION_KEY } from "@/lib/api";
import ConfirmDialog from "@/components/shared/confirm-dialog";

interface OrganizationDetail {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  timezone: string | null;
  currency: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: string;
  owner: { userId: string; email: string | null } | null;
  members: { userId: string; email: string | null; role: string }[];
  propertyCount: number;
  reservationCount: number;
  integrations: { id: string; provider: string; status: string; accountName: string | null }[];
  recentAuditEvents: {
    id: string;
    action: string;
    actorLabel: string | null;
    entityType: string;
    createdAt: string;
  }[];
}

export default function PlatformOrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [suspendConfirmOpen, setSuspendConfirmOpen] = useState(false);
  const [enterDialogOpen, setEnterDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [entering, setEntering] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await apiFetch(`/api/platform-admin/organizations/${orgId}`);
      setOrg(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organization.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (orgId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function handleToggleSuspend() {
    if (!org) return;

    try {
      const action = org.subscriptionStatus === "suspended" ? "reactivate" : "suspend";
      await apiFetch(`/api/platform-admin/organizations/${orgId}/${action}`, { method: "POST" });
      setSuspendConfirmOpen(false);
      setActionMessage(
        action === "suspend" ? "Organization suspended." : "Organization reactivated."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setSuspendConfirmOpen(false);
    }
  }

  async function handleEnter() {
    if (!reason.trim()) return;

    try {
      setEntering(true);
      const res = await apiFetch(`/api/platform-admin/organizations/${orgId}/enter`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });

      window.sessionStorage.setItem(
        PLATFORM_ADMIN_SESSION_KEY,
        JSON.stringify({
          token: res.data.impersonationToken,
          organizationId: res.data.organization.id,
          organizationName: res.data.organization.name,
          reason: reason.trim(),
        })
      );

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to enter organization.");
      setEntering(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading organization...</p>;
  }

  if (error && !org) {
    return <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">{error}</div>;
  }

  if (!org) return null;

  return (
    <div>
      <Link href="/admin/organizations" className="text-sm text-muted-foreground hover:text-foreground">
        ← Organizations
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {org.email ?? "No contact email"} · {org.currency} · Plan: {org.subscriptionPlan}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setEnterDialogOpen(true)}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Enter Organization
          </button>
          <button
            onClick={() => setSuspendConfirmOpen(true)}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
              org.subscriptionStatus === "suspended"
                ? "border-success/40 text-success hover:bg-success/10"
                : "border-destructive/40 text-destructive hover:bg-destructive/10"
            }`}
          >
            {org.subscriptionStatus === "suspended" ? "Reactivate" : "Suspend"}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          {actionMessage}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="solid-panel rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Team</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground/80">
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {org.members.map((m) => (
                <tr key={m.userId}>
                  <td className="py-2 text-foreground">{m.email ?? m.userId}</td>
                  <td className="py-2 capitalize text-muted-foreground">{m.role.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground">Usage</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Properties</dt>
              <dd className="font-medium text-foreground">{org.propertyCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reservations</dt>
              <dd className="font-medium text-foreground">{org.reservationCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Integrations</dt>
              <dd className="font-medium text-foreground">{org.integrations.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium text-foreground">
                {new Date(org.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
          {org.integrations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground/80">No integrations connected.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {org.integrations.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-foreground/80">
                    {i.provider} {i.accountName ? `— ${i.accountName}` : ""}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      i.status === "error"
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-success/30 bg-success/10 text-success"
                    }`}
                  >
                    {i.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
          {org.recentAuditEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground/80">No recorded activity yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {org.recentAuditEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground/80">
                    {e.actorLabel ?? "System"} — <span className="font-mono">{e.action}</span>
                  </span>
                  <span className="text-xs text-muted-foreground/80">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={suspendConfirmOpen}
        title={org.subscriptionStatus === "suspended" ? "Reactivate organization?" : "Suspend organization?"}
        description={
          org.subscriptionStatus === "suspended"
            ? "This organization's members will regain normal access."
            : "This flags the organization as suspended. (Access-blocking enforcement is a deliberate follow-up — this action only sets the status today, see the checkpoint notes.)"
        }
        tone={org.subscriptionStatus === "suspended" ? "info" : "warning"}
        confirmLabel={org.subscriptionStatus === "suspended" ? "Reactivate" : "Suspend"}
        onConfirm={handleToggleSuspend}
        onCancel={() => setSuspendConfirmOpen(false)}
      />

      <ConfirmDialog
        open={enterDialogOpen}
        title="Enter this organization"
        tone="warning"
        confirmLabel={entering ? "Entering..." : "Enter (read-only)"}
        description={
          <div>
            <p>
              You&apos;ll view this organization&apos;s dashboard exactly as its owner would,
              for up to 15 minutes, in read-only mode. This is logged with the reason below.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for entering (required) — e.g. investigating a support ticket"
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              rows={3}
            />
          </div>
        }
        onConfirm={handleEnter}
        onCancel={() => {
          setEnterDialogOpen(false);
          setReason("");
        }}
      />
    </div>
  );
}
