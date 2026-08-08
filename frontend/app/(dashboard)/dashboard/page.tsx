import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/logout-button";
import DashboardStats from "@/components/dashboard/dashboard-stats";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen p-8">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to AI PMS
        </h1>

        <p className="mt-2 text-muted-foreground">
          Logged in as {user.email}
        </p>
      </div>

      <DashboardStats />

      <div className="mt-8">
        <LogoutButton />
      </div>
    </main>
  );
}