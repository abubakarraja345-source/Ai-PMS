"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { getCurrencyMeta } from "@/lib/currency";
import CurrencyPickerModal from "@/components/shared/currency-picker-modal";
import CurrencyDisplayCard from "@/components/shared/currency-display-card";
import ConfirmDialog from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/shared/toast";
import ApprovalSettingsSection from "@/components/settings/approval-settings-section";
import ThemeToggle from "@/components/shared/theme-toggle";
import ColorThemeToggle from "@/components/shared/color-theme-toggle";

interface OrganizationSettings {
  name: string;
  timezone: string;
  currency: string;
  language: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  guestMessageTemplate: string | null;
  updatedAt: string | null;
}

type FormState = {
  name: string;
  timezone: string;
  currency: string;
  language: string;
  checkInTime: string;
  checkOutTime: string;
  guestMessageTemplate: string;
};

function toForm(settings: OrganizationSettings): FormState {
  return {
    name: settings.name,
    timezone: settings.timezone,
    currency: settings.currency,
    language: settings.language,
    checkInTime: settings.checkInTime ?? "",
    checkOutTime: settings.checkOutTime ?? "",
    guestMessageTemplate: settings.guestMessageTemplate ?? "",
  };
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [original, setOriginal] = useState<FormState | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showCurrencyConfirm, setShowCurrencyConfirm] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const { showToast, ToastViewport } = useToast();

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const [settingsResponse, membersResponse] = await Promise.all([
        apiFetch("/api/organization/settings"),
        apiFetch("/api/organization/members"),
      ]);

      const settings: OrganizationSettings = settingsResponse.data;
      const nextForm = toForm(settings);

      setForm(nextForm);
      setOriginal(nextForm);

      const self = (membersResponse.data ?? []).find(
        (member: { userId: string }) =>
          member.userId === session?.user?.id
      );

      setCanEdit(
        self?.role === "owner" || self?.role === "company_admin"
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load organization settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function updateField(field: keyof FormState, value: string) {
    setSuccess(false);
    setForm((current) =>
      current ? { ...current, [field]: value } : current
    );
  }

  const isDirty =
    form !== null &&
    original !== null &&
    JSON.stringify(form) !== JSON.stringify(original);

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleSave() {
    if (!form || !original) return;

    if (form.currency !== original.currency) {
      setShowCurrencyConfirm(true);
      return;
    }

    persistSave();
  }

  async function persistSave() {
    if (!form || !original) return;

    const currencyChanged = form.currency !== original.currency;

    try {
      setSaving(true);
      setError("");
      setSuccess(false);

      const payload: Record<string, string | null> = {};

      if (form.name !== original.name) payload.name = form.name;
      if (form.timezone !== original.timezone)
        payload.timezone = form.timezone;
      if (form.currency !== original.currency)
        payload.currency = form.currency;
      if (form.language !== original.language)
        payload.language = form.language;
      if (form.checkInTime !== original.checkInTime)
        payload.check_in_time = form.checkInTime || null;
      if (form.checkOutTime !== original.checkOutTime)
        payload.check_out_time = form.checkOutTime || null;
      if (form.guestMessageTemplate !== original.guestMessageTemplate)
        payload.guest_message_template =
          form.guestMessageTemplate || null;

      const response = await apiFetch("/api/organization/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const settings: OrganizationSettings = response.data;
      const nextForm = toForm(settings);

      setForm(nextForm);
      setOriginal(nextForm);
      setSuccess(true);

      if (currencyChanged) {
        showToast({
          tone: "success",
          title: "Currency updated",
          description: `New reservations will use ${nextForm.currency}. Existing reservations remain unchanged.`,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to save organization settings.";

      setError(message);

      if (currencyChanged) {
        showToast({
          tone: "error",
          title: "Unable to update currency",
          description: "Your existing currency settings were not changed. Try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!original) return;
    setForm(original);
    setError("");
    setSuccess(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-10">
        <div className="text-slate-500">
          Loading organization settings...
        </div>
      </main>
    );
  }

  if (error && !form) {
    return (
      <main className="min-h-screen bg-slate-50 p-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error}
        </div>
      </main>
    );
  }

  if (!form) return null;

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-4xl font-semibold text-slate-950">
              Settings
            </h1>
            <p className="mt-2 text-lg text-slate-500">
              Manage your organization&apos;s configuration.
            </p>
          </div>

          {isDirty && (
            <div className="flex gap-3">
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Discard
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !canEdit}
                className="rounded-xl bg-[#10172a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#18213a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {!canEdit && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            You have read-only access to organization settings.
            Only an owner or company admin can make changes.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            Settings saved successfully.
          </div>
        )}

        {/* Appearance — personal, not saved to the organization (each
            teammate can pick their own); persisted client-side via
            next-themes, same as the sidebar's Light/Dark/System
            toggle this duplicates for discoverability. */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Appearance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Personal preference — only affects how the app looks for you.
          </p>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-slate-700">Mode</p>
            <div className="max-w-xs">
              <ThemeToggle variant="surface" />
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-slate-700">Color theme</p>
            <p className="mb-3 text-xs text-slate-400">
              Applies in light mode — dark mode always looks the same regardless.
            </p>
            <ColorThemeToggle />
          </div>
        </section>

        {/* Organization */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Organization
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The name of your organization.
          </p>

          <div className="mt-5">
            <label htmlFor="org-name" className="text-sm font-medium text-slate-700">
              Organization Name
            </label>
            <input
              id="org-name"
              type="text"
              value={form.name}
              disabled={!canEdit}
              onChange={(event) =>
                updateField("name", event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </section>

        {/* Localization */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Localization
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            These values are used for display purposes and do not
            affect existing reservations or reports.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="timezone" className="text-sm font-medium text-slate-700">
                Timezone
              </label>
              <input
                id="timezone"
                type="text"
                value={form.timezone}
                disabled={!canEdit}
                onChange={(event) =>
                  updateField("timezone", event.target.value)
                }
                placeholder="e.g. Asia/Karachi"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="language" className="text-sm font-medium text-slate-700">
                Language
              </label>
              <input
                id="language"
                type="text"
                value={form.language}
                disabled={!canEdit}
                onChange={(event) =>
                  updateField("language", event.target.value)
                }
                placeholder="e.g. en"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>
        </section>

        {/* Financial Preferences */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Financial Preferences
            </h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Manage how monetary values are displayed across your
              organization.
            </p>
          </div>

          <div className="p-6">
            <div className="max-w-md">
              <CurrencyDisplayCard
                code={form.currency}
                eyebrow="Organization Currency"
                sourceLabel={
                  canEdit ? "Editable by owners & admins" : "Read-only"
                }
                sourceTone="inherited"
                helperText="All new properties inherit this currency unless they set their own override. Existing reservations always keep the currency they were created with."
              />
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => setShowCurrencyPicker(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Change Currency
              </button>
            )}
          </div>
        </section>

        <CurrencyPickerModal
          open={showCurrencyPicker}
          value={form.currency}
          title="Change organization currency"
          description="This becomes the default for new properties and reservations."
          onChange={(code) => updateField("currency", code)}
          onClose={() => setShowCurrencyPicker(false)}
        />

        {/* Guest Experience */}
        <section className="mt-6 mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Guest Experience
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Default check-in/check-out times and messaging. Individual
            properties may still set their own check-in/check-out
            times.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="checkInTime" className="text-sm font-medium text-slate-700">
                Check-in Time
              </label>
              <input
                id="checkInTime"
                type="time"
                value={form.checkInTime}
                disabled={!canEdit}
                onChange={(event) =>
                  updateField("checkInTime", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div>
              <label htmlFor="checkOutTime" className="text-sm font-medium text-slate-700">
                Check-out Time
              </label>
              <input
                id="checkOutTime"
                type="time"
                value={form.checkOutTime}
                disabled={!canEdit}
                onChange={(event) =>
                  updateField("checkOutTime", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="guestMessageTemplate" className="text-sm font-medium text-slate-700">
              Guest Message Template
            </label>
            <textarea
              id="guestMessageTemplate"
              rows={5}
              value={form.guestMessageTemplate}
              disabled={!canEdit}
              onChange={(event) =>
                updateField(
                  "guestMessageTemplate",
                  event.target.value
                )
              }
              placeholder="e.g. Welcome! Your check-in details are..."
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </section>

        <ApprovalSettingsSection canEdit={canEdit} />
      </div>

      <ConfirmDialog
        open={showCurrencyConfirm}
        tone="warning"
        title="Change organization currency?"
        confirmLabel="Change Currency"
        cancelLabel="Cancel"
        onCancel={() => setShowCurrencyConfirm(false)}
        onConfirm={() => {
          setShowCurrencyConfirm(false);
          persistSave();
        }}
        description={
          <>
            <div className="my-1 flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 py-4">
              <div className="text-center">
                <p className="text-base font-semibold text-slate-900">
                  {getCurrencyMeta(original?.currency).code}
                </p>
                <p className="text-xs text-slate-500">
                  {getCurrencyMeta(original?.currency).name}
                </p>
              </div>

              <ArrowDown size={16} className="text-slate-300" />

              <div className="text-center">
                <p className="text-base font-semibold text-blue-700">
                  {getCurrencyMeta(form?.currency).code}
                </p>
                <p className="text-xs text-slate-500">
                  {getCurrencyMeta(form?.currency).name}
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Existing reservations will remain in their original
              currencies. New reservations will use the new default.
            </p>
          </>
        }
      />

      {ToastViewport}
    </main>
  );
}
