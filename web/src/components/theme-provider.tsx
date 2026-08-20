"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // Everyone lands on light, including visitors whose device is set to
      // dark. Dark is opt-in via the toggle, and that choice is remembered.
      defaultTheme="light"
      enableSystem={false}
      // Transitions on every colour token would otherwise animate the whole
      // page on a theme switch, which reads as a slow smear rather than a flip.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
