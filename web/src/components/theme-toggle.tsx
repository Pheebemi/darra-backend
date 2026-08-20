"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** False during SSR and the hydration pass, true once running on the client. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Light/dark switch.
 *
 * The resolved theme is only known on the client, so the icon renders as a
 * neutral placeholder until hydration — otherwise the server would guess a
 * theme and React would flag the hydration mismatch.
 *
 * `tone="onDark"` is for the permanently dark surfaces (dashboard sidebar,
 * footer) that keep their navy background in both themes, where the default
 * theme-aware colours would wash out.
 */
export function ThemeToggle({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "onDark";
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const isDark = resolvedTheme === "dark";
  const label = !hydrated
    ? "Toggle theme"
    : isDark
      ? "Switch to light mode"
      : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={hydrated ? label : undefined}
      className={cn(
        "rounded-full p-2 transition-colors",
        tone === "onDark"
          ? "text-brand-200 hover:bg-white/10 hover:text-white"
          : "text-body hover:bg-brand-soft hover:text-accent-link",
        className,
      )}
    >
      {hydrated && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
