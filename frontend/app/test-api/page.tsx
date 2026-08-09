"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

const PROPERTY_ID =
  "14a0c53a-5043-4f61-a50e-2feb3089285c";

export default function TestApiPage() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function getProperty() {
    setLoading(true);
    setResult("");

    try {
      const data = await apiFetch(
        `/api/properties/${PROPERTY_ID}`
      );

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "Request failed"
      );
    } finally {
      setLoading(false);
    }
  }
  async function getReservations() {
  setLoading(true);
  setResult("");

  try {
    const data = await apiFetch("/api/reservations");

    setResult(JSON.stringify(data, null, 2));
  } catch (error) {
    setResult(
      error instanceof Error
        ? error.message
        : "Request failed"
    );
  } finally {
    setLoading(false);
  }
}
  async function getDashboardStats() {
  setLoading(true);
  setResult("");

  try {
    const data = await apiFetch(
      "/api/dashboard/stats"
    );

    setResult(JSON.stringify(data, null, 2));
  } catch (error) {
    setResult(
      error instanceof Error
        ? error.message
        : "Request failed"
    );
  } finally {
    setLoading(false);
  }
}
async function createGuest() {
  setLoading(true);
  setResult("");

  try {
    const data = await apiFetch("/api/guests", {
      method: "POST",
      body: JSON.stringify({
        first_name: "John",
        last_name: "Smith",
        email: "john.smith@example.com",
        phone: "+92 300 1234567",
        country: "Pakistan",
        language: "English",
        notes: "Test guest created for PMS reservation testing",
        vip: false,
      }),
    });

    setResult(JSON.stringify(data, null, 2));
  } catch (error) {
    setResult(
      error instanceof Error
        ? error.message
        : "Request failed"
    );
  } finally {
    setLoading(false);
  }
}
async function getReservations() {
  setLoading(true);
  setResult("");

  try {
    const data = await apiFetch("/api/reservations");

    setResult(JSON.stringify(data, null, 2));
  } catch (error) {
    setResult(
      error instanceof Error
        ? error.message
        : "Request failed"
    );
  } finally {
    setLoading(false);
  }
}
  async function updateProperty() {
    setLoading(true);
    setResult("");

    try {
      const data = await apiFetch(
        `/api/properties/${PROPERTY_ID}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: "My First PMS Property",
            description:
              "Updated successfully through the PMS API",
          }),
        }
      );

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "Request failed"
      );
    } finally {
      setLoading(false);
    }
  }
const PROPERTY_ID =
  "ecca9552-f147-4502-876e-85921a61b2a9";

const GUEST_ID =
  "4d0a73ca-fc5e-4aa8-adf8-175d13204d2b";

async function createReservation() {
  setLoading(true);
  setResult("");

  try {
    const data = await apiFetch("/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        property_id: PROPERTY_ID,
        guest_id: GUEST_ID,

        booking_reference: "TEST-001",
        source: "direct",
        status: "confirmed",

        check_in: "2026-08-15",
        check_out: "2026-08-18",

        adults: 2,
        children: 0,
        infants: 0,
        pets: 0,

        total_amount: 300,
        cleaning_fee: 25,
        taxes: 15,

        currency: "USD",

        special_requests:
          "Test reservation created through PMS API",
      }),
    });

    setResult(JSON.stringify(data, null, 2));
  } catch (error) {
    setResult(
      error instanceof Error
        ? error.message
        : "Request failed"
    );
  } finally {
    setLoading(false);
  }
}
  async function deleteProperty() {
    setLoading(true);
    setResult("");

    try {
      const data = await apiFetch(
        `/api/properties/${PROPERTY_ID}`,
        {
          method: "DELETE",
        }
      );

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "Request failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold">
          Property API Test
        </h1>

        <p className="mt-2 text-muted-foreground">
          Test authenticated property operations.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={getProperty}
            disabled={loading}
            className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            {loading ? "Loading..." : "Get Property"}
          </button>

          <button
            onClick={updateProperty}
            disabled={loading}
            className="rounded-lg border px-5 py-3 disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Property"}
          </button>

          <button
            onClick={deleteProperty}
            disabled={loading}
            className="rounded-lg border border-red-500 px-5 py-3 text-red-600 disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Delete Property"}
          </button>
          <button
  onClick={getDashboardStats}
  disabled={loading}
  className="rounded-lg bg-black px-5 py-3 text-white"
>
  Get Dashboard Stats
</button>
<button
  onClick={getReservations}
  disabled={loading}
  className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
>
  {loading ? "Loading..." : "Get Reservations"}
</button>
<button
  onClick={createGuest}
  disabled={loading}
  className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
>
  {loading ? "Creating..." : "Create Test Guest"}
</button>
<button
  onClick={createReservation}
  disabled={loading}
  className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
>
  {loading ? "Creating..." : "Create Test Reservation"}
</button>
<button
  onClick={getReservations}
  disabled={loading}
  className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
>
  {loading ? "Loading..." : "Get Reservations"}
</button>
        </div>

        {result && (
          <pre className="mt-6 overflow-auto rounded-lg border p-5">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}