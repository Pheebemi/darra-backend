"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Transitions on every colour token would otherwise animate the whole
      // page on a theme switch, which reads as a slow smear rather than a flip.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
