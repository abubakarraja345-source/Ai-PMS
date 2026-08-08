import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="rounded-2xl border p-8">
        <h1 className="text-2xl font-semibold">
          Welcome to AI PMS
        </h1>

        <p className="mt-2 text-muted-foreground">
          Logged in as {user.email}
        </p>
      </div>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </main>
  );
}