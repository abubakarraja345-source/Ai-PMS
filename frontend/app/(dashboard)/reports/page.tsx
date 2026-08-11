"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { apiFetch } from "@/lib/api";

interface CurrencyAmount {
  currency: string;
  total: number;
  count: number;
}
interface CurrencyValue {
  currency: string;
  value: number;
}
interface CountBucket {
  key: string;
  count: number;
}
interface TrendPoint {
  bucket: string;
  count: number;
}
interface RevenueTrendPoint {
  bucket: string;
  currency: string;
  total: number;
  count: number;
}
interface OccupancyResult {
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number;
}
interface PropertyReportEntry {
  propertyId: string;
  title: string;
  status: string;
  reservationCount: number;
  revenue: CurrencyAmount[];
  occupancy: OccupancyResult;
}

interface ReportsSummary {
  period: {
    start: string;
    end: string;
    granularity: "day" | "week" | "month";
  };
  overview: {
    totalReservations: number;
    revenue: CurrencyAmount[];
    avgLengthOfStay: number | null;
    adr: CurrencyValue[];
    cancellationRate: number;
    bookingVolume: number;
    occupancyRate: number;
  };
  revenue: {
    trend: RevenueTrendPoint[];
    byCurrency: CurrencyAmount[];
  };
  bookings: {
    volumeTrend: TrendPoint[];
    bySource: CountBucket[];
    byStatus: CountBucket[];
    cancellationRate: number;
    avgLengthOfStay: number | null;
    avgLeadTimeDays: number | null;
  };
  properties: PropertyReportEntry[];
  guests: {
    newGuestsTrend: TrendPoint[];
    vipProportion: number;
    byCountry: CountBucket[];
    byLanguage: CountBucket[];
    repeatGuestCount: number;
    repeatGuestRate: number;
    uniqueGuestCount: number;
  };
  cleaning: {
    taskVolume: number;
    byStatus: CountBucket[];
    byPriority: CountBucket[];
    avgCompletionHours: number | null;
    byProperty: CountBucket[];
  };
  maintenance: {
    ticketVolume: number;
    byStatus: CountBucket[];
    byPriority: CountBucket[];
    byCategory: CountBucket[];
    avgResolutionHours: number | null;
    estimatedCostTotal: number;
    actualCostTotal: number;
    costVariance: number;
  };
  inventory: {
    totalItems: number;
    lowStockCount: number;
    byCategory: CountBucket[];
  };
}

const CHART_COLORS = [
  "#0f172a", // slate-900
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
];

type PresetKey =
  | "7d"
  | "30d"
  | "thisMonth"
  | "3m"
  | "thisYear"
  | "custom";

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetRange(preset: PresetKey): {
  start: string;
  end: string;
} {
  const now = new Date();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  switch (preset) {
    case "7d": {
      const start = new Date(tomorrow);
      start.setDate(start.getDate() - 7);
      return {
        start: toDateOnlyString(start),
        end: toDateOnlyString(tomorrow),
      };
    }
    case "30d": {
      const start = new Date(tomorrow);
      start.setDate(start.getDate() - 30);
      return {
        start: toDateOnlyString(start),
        end: toDateOnlyString(tomorrow),
      };
    }
    case "thisMonth": {
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );
      return {
        start: toDateOnlyString(start),
        end: toDateOnlyString(end),
      };
    }
    case "3m": {
      const start = new Date(
        now.getFullYear(),
        now.getMonth() - 2,
        1
      );
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );
      return {
        start: toDateOnlyString(start),
        end: toDateOnlyString(end),
      };
    }
    case "thisYear": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return {
        start: toDateOnlyString(start),
        end: toDateOnlyString(end),
      };
    }
    default: {
      const start = new Date(tomorrow);
      start.setDate(start.getDate() - 30);
      return {
        start: toDateOnlyString(start),
        end: toDateOnlyString(tomorrow),
      };
    }
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "3m", label: "Last 3 Months" },
  { key: "thisYear", label: "This Year" },
];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value)
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatBucketLabel(
  bucket: string,
  granularity: "day" | "week" | "month"
) {
  if (granularity === "month") {
    const [year, month] = bucket.split("-");
    return new Date(
      Number(year),
      Number(month) - 1,
      1
    ).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  }

  return new Date(
    `${bucket}T00:00:00Z`
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [range, setRange] = useState(() =>
    getPresetRange("30d")
  );
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [summary, setSummary] = useState<ReportsSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/reports/summary?start=${range.start}&end=${range.end}`
      );

      setSummary(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load reports"
      );
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  function applyPreset(key: PresetKey) {
    setPreset(key);
    setRange(getPresetRange(key));
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    setPreset("custom");
    setRange({ start: customStart, end: customEnd });
  }

  const granularity = summary?.period.granularity ?? "day";

  const revenueTrendData = useMemo(() => {
    if (!summary) return [];

    const buckets = new Map<string, Record<string, number>>();

    for (const point of summary.revenue.trend) {
      if (!buckets.has(point.bucket)) {
        buckets.set(point.bucket, {});
      }
      buckets.get(point.bucket)![point.currency] =
        point.total;
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucket, values]) => ({
        bucket: formatBucketLabel(bucket, granularity),
        ...values,
      }));
  }, [summary, granularity]);

  const revenueCurrencies = useMemo(() => {
    if (!summary) return [];
    return Array.from(
      new Set(summary.revenue.trend.map((p) => p.currency))
    );
  }, [summary]);

  const bookingVolumeData = useMemo(() => {
    if (!summary) return [];
    return summary.bookings.volumeTrend.map((p) => ({
      bucket: formatBucketLabel(p.bucket, granularity),
      count: p.count,
    }));
  }, [summary, granularity]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950 md:text-5xl">
            Reports / Analytics
          </h1>

          <p className="mt-2 text-slate-500 md:mt-3 md:text-lg">
            {range.start} → {range.end}
          </p>
        </div>

        <button
          onClick={loadSummary}
          className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {/* Date range controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              preset === p.key
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          />
          <span className="text-sm text-slate-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          />
          <button
            onClick={applyCustomRange}
            disabled={!customStart || !customEnd}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-white"
            />
          ))}
        </div>
      ) : !summary ? null : (
        <div className="mt-8 space-y-8">
          {/* KPI cards */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Reservations"
              value={String(summary.overview.totalReservations)}
              sub="Booked in this period"
            />

            <KpiCard
              label="Revenue"
              value={
                summary.overview.revenue.length === 0
                  ? "No data"
                  : summary.overview.revenue
                      .map((r) =>
                        formatMoney(r.total, r.currency)
                      )
                      .join(" · ")
              }
              sub="Confirmed + completed"
            />

            <KpiCard
              label="Occupancy"
              value={`${summary.overview.occupancyRate}%`}
              sub="Active properties, this range"
            />

            <KpiCard
              label="ADR"
              value={
                summary.overview.adr.length === 0
                  ? "No data"
                  : summary.overview.adr
                      .map((a) =>
                        formatMoney(a.value, a.currency)
                      )
                      .join(" · ")
              }
              sub="Revenue-weighted, per currency"
            />

            <KpiCard
              label="Avg Stay"
              value={
                summary.overview.avgLengthOfStay !== null
                  ? `${summary.overview.avgLengthOfStay} nights`
                  : "No data"
              }
              sub="Confirmed + completed"
            />

            <KpiCard
              label="Cancellation Rate"
              value={`${summary.overview.cancellationRate}%`}
              sub="Of reservations booked"
            />
          </div>

          {/* Revenue + Booking volume charts */}
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="Revenue Trend"
              subtitle="Confirmed + completed, by currency"
            >
              {revenueTrendData.length === 0 ? (
                <EmptyChartState />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={280}
                >
                  <LineChart data={revenueTrendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#64748b" }}
                    />
                    <Tooltip />
                    <Legend />
                    {revenueCurrencies.map((currency, i) => (
                      <Line
                        key={currency}
                        type="monotone"
                        dataKey={currency}
                        stroke={
                          CHART_COLORS[
                            i % CHART_COLORS.length
                          ]
                        }
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Reservation Volume"
              subtitle="Reservations booked over time"
            >
              {bookingVolumeData.length === 0 ? (
                <EmptyChartState />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={280}
                >
                  <BarChart data={bookingVolumeData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "#64748b" }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill={CHART_COLORS[0]}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Source + Status breakdown */}
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="Booking Source"
              subtitle="direct, airbnb, booking.com, vrbo, other"
            >
              <BreakdownChart data={summary.bookings.bySource} />
            </ChartCard>

            <ChartCard
              title="Reservation Status"
              subtitle="confirmed, pending, completed, cancelled"
            >
              <BreakdownChart data={summary.bookings.byStatus} />
            </ChartCard>
          </div>

          {/* Booking lead time note */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Booking Lead Time
            </h2>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {summary.bookings.avgLeadTimeDays !== null
                ? `${summary.bookings.avgLeadTimeDays} days`
                : "No data"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Average days between booking and check-in.
            </p>
          </div>

          {/* Properties */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Property Performance
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Sorted alphabetically — revenue is never mixed
                  across currencies, so properties aren&apos;t
                  ranked by revenue.
                </p>
              </div>

              {summary.properties.length > 0 && (
                <button
                  onClick={() =>
                    downloadCsv(
                      `property-performance-${summary.period.start}-to-${summary.period.end}.csv`,
                      [
                        [
                          "Property",
                          "Reservations",
                          "Revenue",
                          "Occupancy Rate (%)",
                        ],
                        ...summary.properties.map((p) => [
                          p.title,
                          p.reservationCount,
                          p.revenue
                            .map((r) => `${r.total} ${r.currency}`)
                            .join(" / ") || "—",
                          p.occupancy.occupancyRate,
                        ]),
                      ]
                    )
                  }
                  className="flex-shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Export CSV
                </button>
              )}
            </div>

            {summary.properties.length === 0 ? (
              <p className="mt-6 text-sm text-slate-400">
                No properties yet.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-3 pr-4 font-medium">
                        Property
                      </th>
                      <th className="pb-3 pr-4 font-medium">
                        Reservations
                      </th>
                      <th className="pb-3 pr-4 font-medium">
                        Revenue
                      </th>
                      <th className="pb-3 font-medium">
                        Occupancy
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.properties.map((p) => (
                      <tr
                        key={p.propertyId}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {p.title}
                        </td>
                        <td className="py-3 pr-4 text-slate-700">
                          {p.reservationCount}
                        </td>
                        <td className="py-3 pr-4 text-slate-700">
                          {p.revenue.length === 0
                            ? "—"
                            : p.revenue
                                .map((r) =>
                                  formatMoney(
                                    r.total,
                                    r.currency
                                  )
                                )
                                .join(" · ")}
                        </td>
                        <td className="py-3 text-slate-700">
                          {p.occupancy.occupancyRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Guests */}
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="New Guests"
              subtitle="Guests created in this period"
            >
              {summary.guests.newGuestsTrend.length === 0 ? (
                <EmptyChartState />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={240}
                >
                  <BarChart
                    data={summary.guests.newGuestsTrend.map(
                      (p) => ({
                        bucket: formatBucketLabel(
                          p.bucket,
                          granularity
                        ),
                        count: p.count,
                      })
                    )}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: "#64748b" }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill={CHART_COLORS[1]}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}

              <div className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-100 pt-5 text-sm">
                <div>
                  <p className="text-slate-500">VIP</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {summary.guests.vipProportion}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">
                    Repeat Guests
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {summary.guests.repeatGuestRate}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">
                    Unique Guests
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {summary.guests.uniqueGuestCount}
                  </p>
                </div>
              </div>
            </ChartCard>

            <ChartCard
              title="Guest Origin"
              subtitle="By country and language"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Country
                  </p>
                  <BreakdownList
                    data={summary.guests.byCountry}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Language
                  </p>
                  <BreakdownList
                    data={summary.guests.byLanguage}
                  />
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Operational: Cleaning + Maintenance */}
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="Cleaning"
              subtitle="Housekeeping tasks created in this period"
            >
              {summary.cleaning.taskVolume === 0 ? (
                <NoDataState message="No cleaning tasks in this period." />
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">
                        Task Volume
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {summary.cleaning.taskVolume}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">
                        Avg Completion
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {summary.cleaning
                          .avgCompletionHours !== null
                          ? `${summary.cleaning.avgCompletionHours}h`
                          : "No data"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                        By Status
                      </p>
                      <BreakdownList
                        data={summary.cleaning.byStatus}
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                        By Priority
                      </p>
                      <BreakdownList
                        data={summary.cleaning.byPriority}
                      />
                    </div>
                  </div>
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Maintenance"
              subtitle="Tickets created in this period"
            >
              {summary.maintenance.ticketVolume === 0 ? (
                <NoDataState message="No maintenance tickets in this period." />
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">
                        Ticket Volume
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {summary.maintenance.ticketVolume}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">
                        Avg Resolution
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {summary.maintenance
                          .avgResolutionHours !== null
                          ? `${summary.maintenance.avgResolutionHours}h`
                          : "No data"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">
                        Estimated Cost
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {summary.maintenance
                          .estimatedCostTotal ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">
                        Actual Cost
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {summary.maintenance.actualCostTotal ??
                          0}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                        By Status
                      </p>
                      <BreakdownList
                        data={summary.maintenance.byStatus}
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                        By Category
                      </p>
                      <BreakdownList
                        data={summary.maintenance.byCategory}
                      />
                    </div>
                  </div>
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Inventory"
              subtitle="Current stock levels across all properties (point-in-time, not date-range scoped)."
            >
              {summary.inventory.totalItems === 0 ? (
                <p className="text-sm text-slate-400">
                  No inventory items yet.
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">
                        {summary.inventory.totalItems}
                      </p>
                      <p className="text-xs text-slate-500">
                        Total items
                      </p>
                    </div>
                    <div>
                      <p
                        className={`text-2xl font-semibold ${
                          summary.inventory.lowStockCount > 0
                            ? "text-red-600"
                            : "text-slate-900"
                        }`}
                      >
                        {summary.inventory.lowStockCount}
                      </p>
                      <p className="text-xs text-slate-500">
                        Low-stock items
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      By Category
                    </p>
                    <BreakdownList data={summary.inventory.byCategory} />
                  </div>
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </main>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
      No data in this period.
    </div>
  );
}

function NoDataState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function BreakdownChart({ data }: { data: CountBucket[] }) {
  if (data.length === 0) {
    return <EmptyChartState />;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="key"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={(entry: { name?: string; value?: number }) =>
            `${entry.name} (${entry.value})`
          }
        >
          {data.map((entry, i) => (
            <Cell
              key={entry.key}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BreakdownList({ data }: { data: CountBucket[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">No data.</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {data.map((item) => (
        <li
          key={item.key}
          className="flex items-center justify-between"
        >
          <span className="capitalize text-slate-700">
            {item.key}
          </span>
          <span className="font-medium text-slate-900">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
