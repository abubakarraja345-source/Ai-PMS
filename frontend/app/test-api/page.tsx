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

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold">
          Get Property API Test
        </h1>

        <p className="mt-2 text-muted-foreground">
          Fetch the authenticated property by ID.
        </p>

        <button
          onClick={getProperty}
          disabled={loading}
          className="mt-6 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
        >
          {loading ? "Loading..." : "Get Test Property"}
        </button>

        {result && (
          <pre className="mt-6 overflow-auto rounded-lg border p-5">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}