"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating, StarPicker, RatingSummary } from "@/components/star-rating";
import { useAuth } from "@/lib/auth/auth-context";
import { errorMessage } from "@/lib/api/errors";

interface Review {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  user_name: string;
  is_own: boolean;
}

interface ReviewsPayload {
  results: Review[];
  average_rating: number | null;
  review_count: number;
  can_review: boolean;
  has_reviewed: boolean;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function ProductReviews({ productId }: { productId: number | string }) {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<ReviewsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/reviews`);
      if (!res.ok) throw new Error("Failed to load reviews");
      const payload: ReviewsPayload = await res.json();
      setData(payload);

      // Pre-fill the form with the buyer's existing review so a second
      // submission reads as editing rather than starting over.
      const own = payload.results.find((r) => r.is_own);
      if (own) {
        setRating(own.rating);
        setComment(own.comment);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (rating < 1) {
      toast.error("Pick a star rating first");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to save your review");
      toast.success(data?.has_reviewed ? "Review updated" : "Thanks for your review!");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save your review"));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete your review");
      toast.success("Review removed");
      setRating(0);
      setComment("");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete your review"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-accent-link" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">
          Reviews
          {data.review_count > 0 && (
            <span className="ml-2 text-sm font-normal text-faint">
              ({data.review_count})
            </span>
          )}
        </h2>
        <RatingSummary average={data.average_rating} count={data.review_count} />
      </div>

      {/* Write / edit — only for people who actually bought it. */}
      {data.can_review && (
        <div className="mb-8 rounded-2xl border border-line bg-surface-2 p-5">
          <p className="mb-3 text-sm font-medium text-ink">
            {data.has_reviewed ? "Your review" : "Rate this product"}
          </p>
          <StarPicker value={rating} onChange={setRating} disabled={submitting} />
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share what you thought (optional)"
            rows={3}
            maxLength={2000}
            className="mt-4"
          />
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={submit} disabled={submitting} className="rounded-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {data.has_reviewed ? "Update review" : "Post review"}
            </Button>
            {data.has_reviewed && (
              <Button
                variant="ghost"
                onClick={remove}
                disabled={submitting}
                className="rounded-full text-err"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Nudge signed-out visitors, but don't imply anyone can review. */}
      {!data.can_review && !isAuthenticated && (
        <p className="mb-6 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-body">
          Only verified buyers can leave a review.
        </p>
      )}

      {data.results.length === 0 ? (
        <p className="py-6 text-center text-sm text-faint">
          No reviews yet — be the first to share your thoughts.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {data.results.map((review) => (
            <li key={review.id} className="py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StarRating value={review.rating} size="sm" />
                <span className="text-sm font-medium text-ink">{review.user_name}</span>
                {review.is_own && (
                  <span className="rounded-full bg-brand-softer px-2 py-0.5 text-[11px] font-medium text-accent-link">
                    You
                  </span>
                )}
                <span className="text-xs text-faint">{fmtDate(review.created_at)}</span>
              </div>
              {review.comment && (
                <p className="mt-2 text-sm leading-relaxed text-body">{review.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
