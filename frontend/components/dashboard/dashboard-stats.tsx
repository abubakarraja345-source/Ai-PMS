"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Users,
  CheckCircle2,
  ArrowUpRight,
  Plus,
  LogIn,
  LogOut,
  BedDouble,
  Clock,
  DollarSign,
  UserPlus,
  AlertTriangle,
  RadioTower,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatMoney as formatMoneyShared } from "@/lib/currency";
import CurrencyBadge from "@/components/shared/currency-badge";
import AiInsights from "./ai-insights";

interface GuestSummary {
  first_name: string;
  last_name: string | null;
}

interface PropertySummary {
  title: string;
}

interface TodayReservation {
  id: string;
  booking_reference: string | null;
  status: string | null;
  check_in: string;
  check_out: string;
  guest?: GuestSummary | null;
  property?: PropertySummary | null;
}

interface UpcomingReservation extends TodayReservation {
  total_amount: number | null;
  currency: string | null;
}

type RecentActivityItem =
  | {
      type: "reservation_created";
      id: string;
      created_at: string;
      guest: string;
      property: string;
      status: string | null;
      booking_reference: string | null;
    }
  | {
      type: "guest_created";
      id: string;
      created_at: string;
      guest: string;
    };

interface DashboardSummary {
  stats: {
    totalProperties: number;
    activeProperties: number;
    availableProperties: number;
    totalReservations: number;
    pendingReservations: number;
    occupiedProperties: number;
    reviewRequired: number;
    totalGuests: number;
    cleaningTasks: number;
    maintenanceTickets: number;
  };
  today: {
    date: string;
    checkIns: TodayReservation[];
    checkOuts: TodayReservation[];
    currentStaysCount: number;
    pendingReservations: number;
  };
  upcomingReservations: UpcomingReservation[];
  recentActivity: RecentActivityItem[];
  revenue: {
    byCurrency: {
      currency: string;
      total: number;
      count: number;
      totalBase: number;
    }[];
    baseCurrency: string;
  };
  occupancy: {
    occupiedProperties: number;
    activeProperties: number;
    occupancyRate: number;
  };
  cleaning: {
    total: number;
    pending: number;
    inProgress: number;
  };
  maintenance: {
    total: number;
    open: number;
    inProgress: number;
    urgent: number;
  };
  inventory: {
    totalItems: number;
    lowStockCount: number;
  };
  integrations: {
    total: number;
    active: number;
    error: number;
  };
  calendarHealth: {
    healthy: number;
    warning: number;
    error: number;
    disabled: number;
    needsAttention: number;
  };
}

function getGuestName(guest: GuestSummary | null | undefined) {
  if (!guest) return "Unknown guest";
  return `${guest.first_name} ${guest.last_name ?? ""}`.trim();
}

function getStatusClasses(status: string | null) {
  switch (status) {
    case "confirmed":
      return "bg-success/10 text-success border-success/30";
    case "pending":
      return "bg-warning/10 text-warning border-warning/30";
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "completed":
      return "bg-primary/10 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function formatMoney(amount: number | null, currency: string) {
  return formatMoneyShared(amount, currency);
}

function formatDateShort(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" }
  );
}

function formatTimeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function DashboardStats() {
  const [summary, setSummary] = useState<DashboardSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        "/api/dashboard/summary"
      );

      if (!response.success) {
        throw new Error(
          response.error || "Unable to load dashboard"
        );
      }

      setSummary(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard statistics"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {error}

        <button
          onClick={loadSummary}
          className="ml-3 font-medium underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const { stats, today, upcomingReservations, recentActivity, revenue, occupancy, calendarHealth } =
    summary;

  const cards = [
    {
      title: "Total Properties",
      value: stats.totalProperties,
      description: "Properties in your portfolio",
      icon: Building2,
    },
    {
      title: "Active Properties",
      value: stats.activeProperties,
      description: "Currently active",
      icon: CheckCircle2,
    },
    {
      title: "Reservations",
      value: stats.totalReservations,
      description: "Total reservations",
      icon: CalendarDays,
    },
    {
      title: "Pending",
      value: stats.pendingReservations,
      description: "Reservations awaiting confirmation",
      icon: Clock,
    },
    {
      title: "Occupied Properties",
      value: stats.occupiedProperties,
      description: "Occupied right now",
      icon: BedDouble,
    },
    {
      title: "Available Properties",
      value: stats.availableProperties,
      description: "Active and not occupied",
      icon: Building2,
    },
    {
      title: "Review Required",
      value: stats.reviewRequired,
      description: "Reservations flagged for staff review",
      icon: AlertTriangle,
      alert: stats.reviewRequired > 0,
    },
    {
      title: "Guests",
      value: stats.totalGuests,
      description: "Guests in your system",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isAlert = "alert" in card && card.alert;

          return (
            <div
              key={card.title}
              className={`group glass-panel rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                isAlert ? "ring-2 ring-inset ring-warning/40" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>

                  <p
                    className={`mt-3 text-3xl font-semibold tracking-tight ${
                      isAlert ? "text-warning" : "text-foreground"
                    }`}
                  >
                    {card.value}
                  </p>
                </div>

                <div
                  className={`rounded-xl p-3 transition-colors ${
                    isAlert
                      ? "bg-warning/15 text-warning"
                      : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                  }`}
                >
                  <Icon size={20} />
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground/80">
                {card.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* AI Insights */}
      <AiInsights />

      {/* Today + Occupancy + Revenue */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Today */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Today
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(
                  `${today.date}T00:00:00Z`
                ).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <Clock size={20} className="text-muted-foreground/80" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <TodayStat
              label="Check-ins"
              value={today.checkIns.length}
            />
            <TodayStat
              label="Check-outs"
              value={today.checkOuts.length}
            />
            <TodayStat
              label="Current stays"
              value={today.currentStaysCount}
            />
            <TodayStat
              label="Pending"
              value={today.pendingReservations}
            />
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <TodayList
              title="Arriving today"
              icon={LogIn}
              reservations={today.checkIns}
              emptyText="No check-ins today"
            />

            <TodayList
              title="Departing today"
              icon={LogOut}
              reservations={today.checkOuts}
              emptyText="No check-outs today"
            />
          </div>
        </div>

        {/* Occupancy */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Occupancy
            </h2>

            <BedDouble size={20} className="text-muted-foreground/80" />
          </div>

          <p className="mt-6 text-4xl font-semibold tracking-tight text-foreground">
            {occupancy.occupancyRate}%
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            {occupancy.occupiedProperties} of{" "}
            {occupancy.activeProperties} active properties
            occupied
          </p>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${Math.min(
                  occupancy.occupancyRate,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Revenue + Quick Actions */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Revenue */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Financial Overview
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Revenue from confirmed and completed reservations, grouped
                by currency.
              </p>
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSign size={18} />
            </div>
          </div>

          {revenue.byCurrency.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm font-medium text-foreground/70">
                No financial data yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/80">
                New reservation financial activity will appear here once
                bookings are confirmed.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {revenue.byCurrency.map((entry, index) => {
                const isForeign = entry.currency !== revenue.baseCurrency;

                return (
                  <div
                    key={entry.currency}
                    className={`relative overflow-hidden rounded-xl border pl-6 pr-5 py-5 transition hover:shadow-sm ${
                      index === 0
                        ? "border-primary/20 bg-primary/5"
                        : "border-border bg-muted/40"
                    }`}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-1 ${
                        index === 0 ? "bg-primary" : "bg-border"
                      }`}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0">
                        <CurrencyBadge code={entry.currency} variant="compact" />
                      </div>

                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground/80">
                        {entry.count} reservation
                        {entry.count === 1 ? "" : "s"}
                      </span>
                    </div>

                    <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                      {formatMoney(entry.total, entry.currency)}
                    </p>

                    {/* Never re-converted live — this is the sum of
                        each reservation's own amount_base snapshot
                        (computed once at booking time), so it reflects
                        what was actually converted then, not today's
                        rate. Only shown for a currency that isn't
                        already the org's base currency — otherwise
                        it's a redundant "≈ same number" line. */}
                    {isForeign && (
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        ≈ {formatMoney(entry.totalBase, revenue.baseCurrency)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-4">
            {revenue.byCurrency.length > 1 ? (
              <p className="text-xs text-muted-foreground/80">
                Shown separately per currency — amounts are not combined.
              </p>
            ) : (
              <span />
            )}

            <Link
              href="/reports"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
            >
              View financial details
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Operations */}
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Operations
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            What needs attention right now.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              href="/cleaning"
              className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 hover:bg-muted"
            >
              <span className="text-sm text-foreground/80">
                Cleaning tasks
              </span>
              <span className="text-sm font-medium text-foreground">
                {summary.cleaning.pending +
                  summary.cleaning.inProgress}{" "}
                active
              </span>
            </Link>

            <Link
              href="/maintenance"
              className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 hover:bg-muted"
            >
              <span className="text-sm text-foreground/80">
                Maintenance tickets
              </span>
              <span
                className={`text-sm font-medium ${
                  summary.maintenance.urgent > 0
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {summary.maintenance.open +
                  summary.maintenance.inProgress}{" "}
                open
                {summary.maintenance.urgent > 0
                  ? ` (${summary.maintenance.urgent} urgent)`
                  : ""}
              </span>
            </Link>

            <Link
              href="/inventory"
              className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 hover:bg-muted"
            >
              <span className="text-sm text-foreground/80">
                Low-stock inventory
              </span>
              <span
                className={`text-sm font-medium ${
                  summary.inventory.lowStockCount > 0
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {summary.inventory.lowStockCount} item
                {summary.inventory.lowStockCount === 1 ? "" : "s"}
              </span>
            </Link>

            <Link
              href="/integrations"
              className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 hover:bg-muted"
            >
              <span className="text-sm text-foreground/80">
                Integrations
              </span>
              <span
                className={`text-sm font-medium ${
                  summary.integrations.error > 0
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {summary.integrations.active} active
                {summary.integrations.error > 0
                  ? `, ${summary.integrations.error} error`
                  : ""}
              </span>
            </Link>

            <Link
              href="/status"
              className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 hover:bg-muted"
            >
              <span className="text-sm text-foreground/80">
                Calendar health
              </span>
              <span
                className={`text-sm font-medium ${
                  calendarHealth.needsAttention > 0
                    ? "text-warning"
                    : "text-success"
                }`}
              >
                {calendarHealth.needsAttention > 0
                  ? `${calendarHealth.needsAttention} need attention`
                  : "All healthy"}
              </span>
            </Link>

            <Link
              href="/reservations/review"
              className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 hover:bg-muted"
            >
              <span className="text-sm text-foreground/80">
                Review required
              </span>
              <span
                className={`text-sm font-medium ${
                  stats.reviewRequired > 0
                    ? "text-warning"
                    : "text-foreground"
                }`}
              >
                {stats.reviewRequired} reservation
                {stats.reviewRequired === 1 ? "" : "s"}
              </span>
            </Link>
          </div>
        </div>

        {/* Quick actions */}
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Quick Actions
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage your PMS quickly.
          </p>

          <div className="mt-6 space-y-3">
            <QuickAction
              href="/reservations"
              label="New Reservation"
              icon={Plus}
              primary
            />
            <QuickAction
              href="/guests/new"
              label="Add Guest"
              icon={UserPlus}
            />
            <QuickAction
              href="/properties/new"
              label="Add Property"
              icon={Building2}
            />
            <QuickAction
              href="/calendar"
              label="Open Calendar"
              icon={CalendarDays}
            />
          </div>
        </div>
      </div>

      {/* Upcoming reservations */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Upcoming Reservations
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          The next confirmed and pending stays.
        </p>

        {upcomingReservations.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground/80">
              No upcoming reservations.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground/80">
                  <th className="pb-3 pr-4 font-medium">
                    Reference
                  </th>
                  <th className="pb-3 pr-4 font-medium">
                    Guest
                  </th>
                  <th className="pb-3 pr-4 font-medium">
                    Property
                  </th>
                  <th className="pb-3 pr-4 font-medium">
                    Check-in
                  </th>
                  <th className="pb-3 pr-4 font-medium">
                    Check-out
                  </th>
                  <th className="pb-3 pr-4 font-medium">
                    Status
                  </th>
                  <th className="pb-3 font-medium">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {upcomingReservations.map((reservation) => (
                  <tr
                    key={reservation.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-3 pr-4 text-muted-foreground">
                      {reservation.booking_reference ??
                        "—"}
                    </td>
                    <td className="py-3 pr-4 font-medium text-foreground">
                      {getGuestName(reservation.guest)}
                    </td>
                    <td className="py-3 pr-4 text-foreground/80">
                      {reservation.property?.title ??
                        "Unknown property"}
                    </td>
                    <td className="py-3 pr-4 text-foreground/80">
                      {formatDateShort(
                        reservation.check_in
                      )}
                    </td>
                    <td className="py-3 pr-4 text-foreground/80">
                      {formatDateShort(
                        reservation.check_out
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                          reservation.status
                        )}`}
                      >
                        {reservation.status ?? "unknown"}
                      </span>
                    </td>
                    <td className="py-3 text-foreground/80">
                      {formatMoney(
                        reservation.total_amount,
                        reservation.currency ?? "USD"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Recent Activity
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Recent reservations and guests across your
          organization.
        </p>

        {recentActivity.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/70">
                No recent activity
              </p>

              <p className="mt-1 text-xs text-muted-foreground/80">
                Activity will appear here as you manage your
                properties.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-border/60">
            {recentActivity.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    {item.type === "reservation_created" ? (
                      <CalendarDays size={16} />
                    ) : (
                      <UserPlus size={16} />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.type === "reservation_created"
                        ? `New reservation for ${item.guest}`
                        : `New guest: ${item.guest}`}
                    </p>

                    {item.type === "reservation_created" && (
                      <p className="text-xs text-muted-foreground/80">
                        {item.property}
                        {item.booking_reference
                          ? ` · ${item.booking_reference}`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-xs text-muted-foreground/80">
                  {formatTimeAgo(item.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TodayStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-muted/60 p-4">
      <p className="text-2xl font-semibold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TodayList({
  title,
  icon: Icon,
  reservations,
  emptyText,
}: {
  title: string;
  icon: typeof LogIn;
  reservations: TodayReservation[];
  emptyText: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
        <Icon size={15} />
        {title}
      </div>

      {reservations.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground/80">
          {emptyText}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {reservations.map((reservation) => (
            <li
              key={reservation.id}
              className="rounded-lg border border-border px-3 py-2 text-xs"
            >
              <p className="font-medium text-foreground">
                {getGuestName(reservation.guest)}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {reservation.property?.title ??
                  "Unknown property"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
  primary = false,
}: {
  href: string;
  label: string;
  icon: typeof Plus;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-xl p-4 transition ${
        primary
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </span>

      <ArrowUpRight size={17} />
    </Link>
  );
}
