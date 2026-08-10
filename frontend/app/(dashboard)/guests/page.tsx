"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Guest {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  vip: boolean;
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadGuests() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/api/guests");

      setGuests(response.data ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load guests"
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteGuest(guestId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this guest?\n\nThis action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingId(guestId);
      setError("");

      await apiFetch(`/api/guests/${guestId}`, {
        method: "DELETE",
      });

      // Remove it immediately from the UI
      setGuests((current) =>
        current.filter((guest) => guest.id !== guestId)
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete guest"
      );
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    loadGuests();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-semibold text-slate-950">
            Guests
          </h1>

          <p className="mt-3 text-lg text-slate-500">
            Manage your guest profiles and contact details.
          </p>
        </div>

        <button
          className="rounded-xl bg-[#10172a] px-6 py-4 text-white hover:bg-[#18213a]"
          onClick={() => {
            window.location.href = "/guests/new";
          }}
        >
          + Add Guest
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-slate-500">
          Loading guests...
        </div>
      ) : guests.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            No guests yet
          </h2>

          <p className="mt-2 text-slate-500">
            Add your first guest to start tracking reservations.
          </p>
        </div>
      ) : (
        <div className="mt-12 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          {guests.map((guest) => (
            <div
              key={guest.id}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {guest.first_name} {guest.last_name || ""}
                  </h2>

                  <p className="mt-2 text-lg text-slate-500">
                    {guest.email || "No email"}
                  </p>
                </div>

                {guest.vip && (
                  <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-600">
                    VIP
                  </span>
                )}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-slate-400">Phone</p>
                  <p className="mt-2 text-slate-800">
                    {guest.phone || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400">Country</p>
                  <p className="mt-2 text-slate-800">
                    {guest.country || "—"}
                  </p>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="mt-8 grid grid-cols-3 gap-3">
                <button
                  onClick={() =>
                    (window.location.href = `/guests/${guest.id}`)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3 text-slate-800 hover:bg-slate-50"
                >
                  View
                </button>

                <button
                  onClick={() =>
                    (window.location.href = `/guests/${guest.id}/edit`)
                  }
                  className="rounded-xl bg-[#10172a] px-4 py-3 text-white hover:bg-[#18213a]"
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteGuest(guest.id)}
                  disabled={deletingId === guest.id}
                  className="rounded-xl border border-red-200 px-4 py-3 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === guest.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
