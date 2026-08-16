"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Thin wrapper so app/layout.tsx (a server component) can render a
 * client-only provider without itself becoming "use client". Uses the
 * `class` attribute strategy to match globals.css's existing
 * `@custom-variant dark (&:is(.dark *))` selector.
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
