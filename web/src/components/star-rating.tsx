"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
} as const;

/**
 * Read-only star row.
 *
 * Renders half-stars by clipping a filled row over an empty one, so a 3.5
 * average doesn't have to round to a whole star.
 */
export function StarRating({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const icon = SIZES[size];

  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden="true">
      <span className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(icon, "text-line-strong")} fill="currentColor" />
        ))}
      </span>
      <span
        className="absolute inset-0 flex overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className={cn(icon, "shrink-0 text-amber-400")} fill="currentColor" />
        ))}
      </span>
    </span>
  );
}

/** Star row plus the numeric average and review count. */
export function RatingSummary({
  average,
  count,
  size = "md",
  className,
}: {
  average: number | null;
  count: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  // An unrated product still shows the star row, greyed out. Hiding it
  // entirely made the rating look like a missing feature rather than an
  // empty one, and left the card layout shifting once a first review landed.
  const unrated = !count || average === null;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <StarRating value={unrated ? 0 : average} size={size} />
      {unrated ? (
        <span className="text-xs text-faint">No reviews yet</span>
      ) : (
        <span className="text-xs font-medium text-body">
          {average.toFixed(1)}
          <span className="ml-1 font-normal text-faint">({count})</span>
        </span>
      )}
      <span className="sr-only">
        {unrated
          ? "Not yet rated"
          : `Rated ${average.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}
      </span>
    </span>
  );
}

/** Interactive 1–5 picker used by the write-a-review form. */
export function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="rounded-full p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              star <= value ? "text-amber-400" : "text-line-strong"
            )}
            fill="currentColor"
          />
        </button>
      ))}
    </div>
  );
}
