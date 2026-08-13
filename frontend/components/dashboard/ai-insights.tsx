"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, Info, AlertOctagon } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Insight = {
  type: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

function severityClasses(severity: Insight["severity"]) {
  switch (severity) {
    case "critical":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning";
    default:
      return "border-border bg-muted text-foreground/80";
  }
}

function SeverityIcon({ severity }: { severity: Insight["severity"] }) {
  if (severity === "critical") return <AlertOctagon size={16} />;
  if (severity === "warning") return <AlertTriangle size={16} />;
  return <Info size={16} />;
}

export default function AiInsights() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setError("");
        const response = await apiFetch("/api/ai/insights");
        setInsights(response.data ?? []);
      } catch (err) {
        setInsights(null);
        setError(
          err instanceof Error ? err.message : "Failed to load insights."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          AI Insights
        </h2>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Automatically derived from your current PMS data.
      </p>

      <div className="mt-5">
        {loading ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !insights || insights.length === 0 ? (
          <p className="text-sm text-muted-foreground/80">
            Nothing needs attention right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li
                key={insight.type}
                className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${severityClasses(
                  insight.severity
                )}`}
              >
                <span className="mt-0.5">
                  <SeverityIcon severity={insight.severity} />
                </span>
                {insight.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
