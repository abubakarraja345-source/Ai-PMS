"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { apiFetch } from "@/lib/api";

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
    totalReservations: number;
    pendingReservations: number;
    occupiedProperties: number;
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
    }[];
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
}

function getGuestName(guest: GuestSummary | null | undefined) {
  if (!guest) return "Unknown guest";
  return `${guest.first_name} ${guest.last_name ?? ""}`.trim();
}

function getStatusClasses(status: string | null) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";
    case "completed":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function formatMoney(amount: number | null, currency: string) {
  if (amount === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
            className="h-36 animate-pulse rounded-2xl bg-white"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
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

  const { stats, today, upcomingReservations, recentActivity, revenue, occupancy } =
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

          return (
            <div
              key={card.title}
              className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {card.title}
                  </p>

                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                    {card.value}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 p-3 text-slate-700 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                  <Icon size={20} />
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                {card.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Today + Occupancy + Revenue */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Today */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Today
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {new Date(
                  `${today.date}T00:00:00Z`
                ).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <Clock size={20} className="text-slate-400" />
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
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Occupancy
            </h2>

            <BedDouble size={20} className="text-slate-400" />
          </div>

          <p className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">
            {occupancy.occupancyRate}%
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {occupancy.occupiedProperties} of{" "}
            {occupancy.activeProperties} active properties
            occupied
          </p>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
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
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Revenue
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                From confirmed and completed reservations.
              </p>
            </div>

            <DollarSign
              size={20}
              className="text-slate-400"
            />
          </div>

          {revenue.byCurrency.length === 0 ? (
            <p className="mt-8 text-sm text-slate-400">
              No revenue yet.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {revenue.byCurrency.map((entry) => (
                <div
                  key={entry.currency}
                  className="rounded-xl bg-slate-50 p-5"
                >
                  <p className="text-sm text-slate-500">
                    {entry.currency}
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatMoney(
                      entry.total,
                      entry.currency
                    )}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {entry.count} reservation
                    {entry.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}

          {revenue.byCurrency.length > 1 && (
            <p className="mt-4 text-xs text-slate-400">
              Shown separately per currency — amounts are not
              combined.
            </p>
          )}
        </div>

        {/* Operations */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Operations
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            What needs attention right now.
          </p>

          <div className="mt-5 space-y-3">
            <a
              href="/cleaning"
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 hover:bg-slate-100"
            >
              <span className="text-sm text-slate-700">
                Cleaning tasks
              </span>
              <span className="text-sm font-medium text-slate-900">
                {summary.cleaning.pending +
                  summary.cleaning.inProgress}{" "}
                active
              </span>
            </a>

            <a
              href="/maintenance"
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 hover:bg-slate-100"
            >
              <span className="text-sm text-slate-700">
                Maintenance tickets
              </span>
              <span
                className={`text-sm font-medium ${
                  summary.maintenance.urgent > 0
                    ? "text-red-600"
                    : "text-slate-900"
                }`}
              >
                {summary.maintenance.open +
                  summary.maintenance.inProgress}{" "}
                open
                {summary.maintenance.urgent > 0
                  ? ` (${summary.maintenance.urgent} urgent)`
                  : ""}
              </span>
            </a>

            <a
              href="/inventory"
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 hover:bg-slate-100"
            >
              <span className="text-sm text-slate-700">
                Low-stock inventory
              </span>
              <span
                className={`text-sm font-medium ${
                  summary.inventory.lowStockCount > 0
                    ? "text-red-600"
                    : "text-slate-900"
                }`}
              >
                {summary.inventory.lowStockCount} item
                {summary.inventory.lowStockCount === 1 ? "" : "s"}
              </span>
            </a>

            <a
              href="/integrations"
              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 hover:bg-slate-100"
            >
              <span className="text-sm text-slate-700">
                Integrations
              </span>
              <span
                className={`text-sm font-medium ${
                  summary.integrations.error > 0
                    ? "text-red-600"
                    : "text-slate-900"
                }`}
              >
                {summary.integrations.active} active
                {summary.integrations.error > 0
                  ? `, ${summary.integrations.error} error`
                  : ""}
              </span>
            </a>
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Quick Actions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
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
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Upcoming Reservations
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          The next confirmed and pending stays.
        </p>

        {upcomingReservations.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center">
            <p className="text-sm text-slate-400">
              No upcoming reservations.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
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
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-3 pr-4 text-slate-500">
                      {reservation.booking_reference ??
                        "—"}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {getGuestName(reservation.guest)}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {reservation.property?.title ??
                        "Unknown property"}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {formatDateShort(
                        reservation.check_in
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
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
                    <td className="py-3 text-slate-700">
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
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Recent Activity
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Recent reservations and guests across your
          organization.
        </p>

        {recentActivity.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">
                No recent activity
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Activity will appear here as you manage your
                properties.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-slate-50">
            {recentActivity.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                    {item.type === "reservation_created" ? (
                      <CalendarDays size={16} />
                    ) : (
                      <UserPlus size={16} />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.type === "reservation_created"
                        ? `New reservation for ${item.guest}`
                        : `New guest: ${item.guest}`}
                    </p>

                    {item.type === "reservation_created" && (
                      <p className="text-xs text-slate-400">
                        {item.property}
                        {item.booking_reference
                          ? ` · ${item.booking_reference}`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-xs text-slate-400">
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
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-2xl font-semibold text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
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
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Icon size={15} />
        {title}
      </div>

      {reservations.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">
          {emptyText}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {reservations.map((reservation) => (
            <li
              key={reservation.id}
              className="rounded-lg border border-slate-100 px-3 py-2 text-xs"
            >
              <p className="font-medium text-slate-900">
                {getGuestName(reservation.guest)}
              </p>
              <p className="mt-0.5 text-slate-500">
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
    <a
      href={href}
      className={`flex items-center justify-between rounded-xl p-4 transition ${
        primary
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "border border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </span>

      <ArrowUpRight size={17} />
    </a>
  );
}
