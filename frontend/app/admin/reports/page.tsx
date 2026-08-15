"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/currency";

/**
 * Validated categorical palette (dataviz skill, dark-mode column —
 * this page always renders inside the admin section's forced-dark
 * scope). Slots 1-3 (blue/orange/aqua) are the ones the skill's own
 * reference confirms clear the all-pairs CVD/contrast floors, so
 * this page never uses more than 3 series in one chart — a 4th
 * distinct value folds into "Other" rather than adding a new hue.
 */
const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70"];
const GRID_COLOR = "rgba(255,255,255,0.08)";
const AXIS_COLOR = "rgba(255,255,255,0.5)";

interface RevenueTrendPoint {
  bucket: string;
  currency: string;
  total: number;
  count: number;
}
interface TrendPoint {
  bucket: string;
  count: number;
}
interface LeaderboardEntry {
  organizationId: string;
  name: string;
  bookingCount: number;
  revenue: { currency: string; total: number; count: number }[];
  propertyCount: number;
}
interface PlatformReports {
  period: { start: string; end: string; granularity: "day" | "week" | "month" };
  revenueTrend: RevenueTrendPoint[];
  bookingTrend: TrendPoint[];
  leaderboard: LeaderboardEntry[];
  growth: { organizations: TrendPoint[]; users: TrendPoint[] };
}

/** Folds every currency past the top N (by total volume) into "Other"
 * — keeps the chart to the palette's validated 3-series cap instead
 * of growing a new hue per currency. */
function topCurrencies(points: RevenueTrendPoint[], max: number): string[] {
  const totals = new Map<string, number>();
  for (const p of points) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.total);
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([currency]) => currency);
}

function pivotRevenueTrend(points: RevenueTrendPoint[]) {
  const keep = topCurrencies(points, 3);
  const buckets = new Map<string, Record<string, number | string>>();

  for (const p of points) {
    const row = buckets.get(p.bucket) ?? { bucket: p.bucket };
    const key = keep.includes(p.currency) ? p.currency : "Other";
    row[key] = ((row[key] as number) ?? 0) + p.total;
    buckets.set(p.bucket, row);
  }

  return {
    data: Array.from(buckets.values()).sort((a, b) =>
      String(a.bucket).localeCompare(String(b.bucket))
    ),
    series: keep,
  };
}

function mergeGrowth(organizations: TrendPoint[], users: TrendPoint[]) {
  const buckets = new Map<string, { bucket: string; organizations: number; users: number }>();

  for (const p of organizations) {
    buckets.set(p.bucket, { bucket: p.bucket, organizations: p.count, users: 0 });
  }
  for (const p of users) {
    const row = buckets.get(p.bucket) ?? { bucket: p.bucket, organizations: 0, users: 0 };
    row.users = p.count;
    buckets.set(p.bucket, row);
  }

  return Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export default function PlatformReportsPage() {
  const [reports, setReports] = useState<PlatformReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await apiFetch("/api/platform-admin/reports");
        setReports(res.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load platform reports.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const revenuePivot = useMemo(
    () => (reports ? pivotRevenueTrend(reports.revenueTrend) : { data: [], series: [] }),
    [reports]
  );
  const growthData = useMemo(
    () => (reports ? mergeGrowth(reports.growth.organizations, reports.growth.users) : []),
    [reports]
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold text-foreground">Platform Reports</h1>
      <p className="mt-2 text-muted-foreground">
        Revenue, bookings, and growth across every organization — trailing 90 days.
      </p>

      {loading ? (
        <p className="mt-6 text-muted-foreground">Loading...</p>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          {error}
        </div>
      ) : reports ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-foreground">Revenue Trend</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Never blended across currencies — each currency is its own line.
              </p>

              {revenuePivot.data.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenuePivot.data}>
                      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                      <XAxis dataKey="bucket" stroke={AXIS_COLOR} fontSize={11} />
                      <YAxis stroke={AXIS_COLOR} fontSize={11} />
                      <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        labelStyle={{ color: "#f1f5f9" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {revenuePivot.series.map((currency, i) => (
                        <Line
                          key={currency}
                          type="monotone"
                          dataKey={currency}
                          name={currency}
                          stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-foreground">Booking Volume</h2>
              <p className="mt-1 text-sm text-muted-foreground">New reservations created, across all organizations.</p>

              {reports.bookingTrend.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reports.bookingTrend}>
                      <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                      <XAxis dataKey="bucket" stroke={AXIS_COLOR} fontSize={11} />
                      <YAxis stroke={AXIS_COLOR} fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        labelStyle={{ color: "#f1f5f9" }}
                      />
                      <Bar dataKey="count" name="Bookings" fill={SERIES_COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground">Platform Growth</h2>
            <p className="mt-1 text-sm text-muted-foreground">New organizations and new users signed up over time.</p>

            {growthData.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthData}>
                    <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="bucket" stroke={AXIS_COLOR} fontSize={11} />
                    <YAxis stroke={AXIS_COLOR} fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      labelStyle={{ color: "#f1f5f9" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="organizations" name="New Organizations" stroke={SERIES_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="users" name="New Users" stroke={SERIES_COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="solid-panel rounded-2xl overflow-hidden">
            <div className="p-6 pb-0">
              <h2 className="text-lg font-semibold text-foreground">Organization Leaderboard</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ranked by bookings in the last 90 days.</p>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Organization</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Bookings</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Revenue</th>
                    <th className="px-6 py-3 font-medium text-muted-foreground">Listings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reports.leaderboard.slice(0, 20).map((org) => (
                    <tr key={org.organizationId}>
                      <td className="px-6 py-3 font-medium text-foreground">{org.name}</td>
                      <td className="px-6 py-3 text-muted-foreground">{org.bookingCount}</td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {org.revenue.length === 0
                          ? "—"
                          : org.revenue.map((r) => formatMoney(r.total, r.currency)).join(", ")}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{org.propertyCount}</td>
                    </tr>
                  ))}
                  {reports.leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground/80">
                        No organizations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 flex h-72 items-center justify-center rounded-xl border border-dashed border-border">
      <p className="text-sm text-muted-foreground/80">No data in this period.</p>
    </div>
  );
}
