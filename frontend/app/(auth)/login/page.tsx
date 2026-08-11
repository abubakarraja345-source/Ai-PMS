import { redirect } from "next/navigation";

/**
 * This route (`/login`) was a dead stub with no functionality and no
 * incoming links anywhere in the app — the real login page has always
 * been `/auth/login`. Redirecting rather than deleting keeps anyone
 * who bookmarked or indexed `/login` from hitting a broken page.
 */
export default function LoginRedirectPage() {
  redirect("/auth/login");
}
