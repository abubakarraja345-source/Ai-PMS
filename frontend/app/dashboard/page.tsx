import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div>
        <h1 className="text-3xl font-bold">
          Hostly Dashboard
        </h1>

        <p className="mt-4">
          Logged in as: {user?.email ?? "Not logged in"}
        </p>
      </div>
    </main>
  );
}
