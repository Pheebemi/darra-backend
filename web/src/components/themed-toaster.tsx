"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

/**
 * Toaster tied to the app's own theme rather than sonner's "system" default.
 * Now that dark is opt-in, a visitor on a dark device sees the light UI — and
 * "system" would have popped dark toasts on top of it.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      position="top-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
