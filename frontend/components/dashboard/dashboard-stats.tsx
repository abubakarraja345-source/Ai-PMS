"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  Users,
  Sparkles,
  Wrench,
  CheckCircle2,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DashboardStats {
  totalProperties: number;
  activeProperties: number;
  totalReservations: number;
  totalGuests: number;
  cleaningTasks: number;
  maintenanceTickets: number;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await apiFetch("/api/dashboard/stats");

        if (!response.success) {
          throw new Error(
            response.error || "Unable to load dashboard"
          );
        }

        setStats(response.data);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard statistics"
        );
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

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
      </div>
    );
  }

  if (!stats) return null;

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
      title: "Guests",
      value: stats.totalGuests,
      description: "Guests in your system",
      icon: Users,
    },
    {
      title: "Cleaning Tasks",
      value: stats.cleaningTasks,
      description: "Tasks requiring attention",
      icon: Sparkles,
    },
    {
      title: "Maintenance",
      value: stats.maintenanceTickets,
      description: "Open maintenance tickets",
      icon: Wrench,
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

      {/* Lower dashboard */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Portfolio overview */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Portfolio Overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your property portfolio at a glance.
              </p>
            </div>

            <Building2
              size={20}
              className="text-slate-400"
            />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Total
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {stats.totalProperties}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Active
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {stats.activeProperties}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">
                Inactive
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {Math.max(
                  stats.totalProperties -
                    stats.activeProperties,
                  0
                )}
              </p>
            </div>
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
            <a
              href="/properties"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50"
            >
              <span className="flex items-center gap-3">
                <Building2 size={18} />
                <span className="text-sm font-medium">
                  View Properties
                </span>
              </span>

              <ArrowUpRight size={17} />
            </a>

            <a
              href="/properties/new"
              className="flex items-center justify-between rounded-xl bg-slate-900 p-4 text-white transition hover:bg-slate-800"
            >
              <span className="flex items-center gap-3">
                <Plus size={18} />
                <span className="text-sm font-medium">
                  Add Property
                </span>
              </span>

              <ArrowUpRight size={17} />
            </a>
          </div>
        </div>
      </div>

      {/* Empty activity section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Activity
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Recent activity across your organization.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            Coming soon
          </span>
        </div>

        <div className="flex min-h-32 items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">
              No recent activity
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Activity will appear here as you manage your properties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}