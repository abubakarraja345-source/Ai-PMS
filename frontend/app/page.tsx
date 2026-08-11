"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Globe2,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

export default function HomePage() {
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          window.location.href = "/dashboard";
          return;
        }
      } catch {
        // Public landing page should remain accessible
      } finally {
        if (mounted) {
          setCheckingAuth(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <span className="text-sm">Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-300px] h-[650px] w-[900px] -translate-x-1/2 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute right-[-200px] top-[500px] h-[500px] w-[500px] rounded-full bg-indigo-100/50 blur-3xl" />
      </div>

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-900/10">
              <Building2 className="h-5 w-5" />
            </div>

            <div>
              <div className="text-lg font-bold tracking-tight">AI PMS</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Property Management
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Features
            </a>

            <a
              href="#platform"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Platform
            </a>

            <a
              href="#about"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              About
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
            >
              Sign in
            </Link>

            <Link
              href="/auth/login"
              className="group inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-20 lg:px-8 lg:pb-28 lg:pt-28">
          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_.95fr]">
            {/* Left */}
            <div>
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
                <Sparkles className="h-4 w-4" />
                Smarter property management
              </div>

              <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-6xl lg:text-7xl">
                Run your properties.
                <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Smarter with AI.
                </span>
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                AI PMS brings your properties, reservations, guests, cleaning,
                maintenance, inventory, reports and AI-powered operations into
                one modern workspace.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/login"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Access your workspace
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>

                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Explore platform
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Centralized operations
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Role-based access
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  AI-assisted workflows
                </div>
              </div>
            </div>

            {/* Dashboard preview */}
            <div className="relative">
              <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-blue-200/50 to-indigo-200/40 blur-2xl" />

              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
                {/* Fake browser header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  </div>

                  <div className="rounded-md bg-white px-10 py-1.5 text-[10px] text-slate-400 shadow-sm">
                    app.ai-pms.com
                  </div>

                  <div className="w-10" />
                </div>

                <div className="grid min-h-[430px] grid-cols-[150px_1fr]">
                  {/* Sidebar */}
                  <aside className="border-r border-slate-200 bg-slate-950 p-4 text-white">
                    <div className="mb-8 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold">AI PMS</span>
                    </div>

                    <div className="space-y-1">
                      {[
                        ["Dashboard", LayoutDashboard],
                        ["Properties", Building2],
                        ["Reservations", CalendarDays],
                        ["Guests", Users],
                        ["Cleaning", Sparkles],
                        ["Maintenance", Wrench],
                      ].map(([label, Icon]) => (
                        <div
                          key={String(label)}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] ${
                            label === "Dashboard"
                              ? "bg-white/10 text-white"
                              : "text-slate-400"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </div>
                      ))}
                    </div>
                  </aside>

                  {/* Dashboard content */}
                  <div className="bg-[#f8fafc] p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-slate-900">
                          Good morning
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">
                          Here's what's happening across your properties.
                        </div>
                      </div>

                      <div className="h-8 w-8 rounded-full bg-blue-100" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Properties", "24", Building2],
                        ["Reservations", "86", CalendarDays],
                        ["Guests", "143", Users],
                        ["Tasks", "18", ClipboardList],
                      ].map(([title, value, Icon]) => (
                        <div
                          key={String(title)}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-[9px] font-medium text-slate-500">
                              {String(title)}
                            </div>
                            <Icon className="h-3.5 w-3.5 text-blue-500" />
                          </div>

                          <div className="mt-2 text-xl font-bold text-slate-900">
                            {String(value)}
                          </div>

                          <div className="mt-1 text-[8px] text-emerald-600">
                            ↑ 12.4% this month
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-[1.4fr_1fr] gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-[10px] font-semibold">
                          Revenue overview
                        </div>

                        <div className="mt-5 flex h-24 items-end gap-2">
                          {[35, 52, 42, 67, 55, 78, 88, 72, 94, 82].map(
                            (height, index) => (
                              <div
                                key={index}
                                className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-blue-300"
                                style={{ height: `${height}%` }}
                              />
                            )
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="text-[10px] font-semibold">
                          Today's activity
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-emerald-100" />
                            <div className="h-2 w-20 rounded bg-slate-100" />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-blue-100" />
                            <div className="h-2 w-24 rounded bg-slate-100" />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-orange-100" />
                            <div className="h-2 w-16 rounded bg-slate-100" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating AI card */}
              <div className="absolute -bottom-7 -left-7 hidden w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:block">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Sparkles className="h-4 w-4" />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      AI Assistant
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      Analyze operations, generate insights and assist with
                      property management tasks.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST / PLATFORM STRIP */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-7 lg:px-8">
          <div className="text-sm font-medium text-slate-500">
            One platform for your entire operation
          </div>

          <div className="flex flex-wrap gap-6 text-sm font-semibold text-slate-400">
            <span>PROPERTIES</span>
            <span>RESERVATIONS</span>
            <span>GUESTS</span>
            <span>OPERATIONS</span>
            <span>AI</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold text-blue-600">
            Everything connected
          </div>

          <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Everything you need to manage properties efficiently.
          </h2>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            Replace scattered tools and manual workflows with one centralized
            platform designed for modern property operations.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: LayoutDashboard,
              title: "Centralized Dashboard",
              text: "Get a clear operational overview of your properties, reservations, guests and daily activity.",
            },
            {
              icon: Building2,
              title: "Property Management",
              text: "Manage your properties, media, information and operational details from one place.",
            },
            {
              icon: CalendarDays,
              title: "Reservations",
              text: "Keep bookings, dates, guests and reservation activity organized in a single workflow.",
            },
            {
              icon: Users,
              title: "Guest Management",
              text: "Maintain guest information and connect guest activity directly with reservations.",
            },
            {
              icon: Wrench,
              title: "Operations",
              text: "Coordinate cleaning and maintenance tasks while keeping operational work visible.",
            },
            {
              icon: Sparkles,
              title: "AI Assistance",
              text: "Use AI-powered capabilities to analyze information and assist with operational decisions.",
            },
          ].map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mt-6 text-lg font-bold text-slate-950">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {feature.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PLATFORM */}
      <section id="platform" className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-blue-400">
                Built for operations
              </div>

              <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
                From reservations to maintenance, keep everything connected.
              </h2>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
                AI PMS gives property teams a shared operational workspace so
                important information doesn't get lost between spreadsheets,
                messages and disconnected tools.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  "Role-based access for teams",
                  "Organization-level data isolation",
                  "Operational notifications",
                  "Inventory and property management",
                  "Reports and AI-powered insights",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-400" />
                    <span className="text-sm text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: ShieldCheck,
                  title: "Secure",
                  text: "Role-based access and protected APIs.",
                },
                {
                  icon: Zap,
                  title: "Efficient",
                  text: "Designed around real operational workflows.",
                },
                {
                  icon: BarChart3,
                  title: "Insights",
                  text: "Understand what's happening across your business.",
                },
                {
                  icon: MessageSquare,
                  title: "AI Ready",
                  text: "AI assistance integrated into your workspace.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:bg-white/[0.07]"
                  >
                    <Icon className="h-6 w-6 text-blue-400" />

                    <h3 className="mt-5 font-semibold">{item.title}</h3>

                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT / CTA */}
      <section id="about" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-14 text-white shadow-2xl shadow-blue-900/20 sm:px-14">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold text-blue-100">
              Ready to manage smarter?
            </div>

            <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Your property operations deserve one intelligent workspace.
            </h2>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">
              Sign in to access your AI PMS workspace and manage your
              properties, reservations, guests and operations from one place.
            </p>

            <Link
              href="/auth/login"
              className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-50"
            >
              Enter AI PMS
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="font-bold">AI PMS</span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Intelligent property management for modern teams.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>

            <a href="#platform" className="hover:text-slate-900">
              Platform
            </a>

            <Link href="/auth/login" className="hover:text-slate-900">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}