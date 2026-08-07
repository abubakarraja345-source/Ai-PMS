import { supabase } from "@/lib/supabase";

export const authService = {
  async signIn(email: string) {
    return await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });
  },

  async signOut() {
    return await supabase.auth.signOut();
  },

  async getSession() {
    return await supabase.auth.getSession();
  },

  async getUser() {
    return await supabase.auth.getUser();
  },
};