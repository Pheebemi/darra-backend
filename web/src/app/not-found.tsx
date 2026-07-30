import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-page px-6 py-16 text-center">
      <img
        src="/illustrations/web-search.svg"
        alt=""
        className="w-full max-w-[280px]"
      />
      <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-brand-500">
        404 — Page not found
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-600">
        The link may be broken, or the page may have moved. Let&apos;s get you back
        on track.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Back home
        </Link>
        <Link
          href="/products"
          className="rounded-full border border-brand-500 px-6 py-3 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-50"
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
