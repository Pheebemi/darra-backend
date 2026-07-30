// Browser-side Sentry init. Runs on every page load. The DSN is public (it
// ships in the client bundle) and read from NEXT_PUBLIC_SENTRY_DSN — when it's
// unset (e.g. local dev) Sentry simply stays disabled and sends nothing.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Keep it light for the free tier: capture errors, sample a little tracing.
  tracesSampleRate: 0.1,
  // Session Replay off (it burns quota fast); flip on later if wanted.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
