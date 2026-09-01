"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationAutocompleteProps {
  value: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (location: string, latitude: number | null, longitude: number | null) => void;
  className?: string;
}

/**
 * Address field with live suggestions and an inline pin preview.
 *
 * Selecting a suggestion stores its coordinates alongside the text, so the
 * buyer-facing map can render from that confirmed pin instead of re-guessing
 * the location by re-geocoding free text on every page view. Editing the
 * text after a pin is set clears the coordinates — a stale pin must never
 * travel attached to different text.
 */
export function LocationAutocomplete({
  value,
  latitude,
  longitude,
  onChange,
  className,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPin = latitude !== null && longitude !== null;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const search = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 400);
  };

  const handleTextChange = (text: string) => {
    // A pin only stays valid for the exact text it was picked for — once the
    // seller edits it, the coordinates are stale until they pick again.
    onChange(text, null, null);
    setOpen(true);
    search(text);
  };

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.display_name, parseFloat(suggestion.lat), parseFloat(suggestion.lon));
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor="location" className="text-sm font-medium text-strong">
        Address / Location
      </Label>
      <div className="relative">
        <Input
          id="location"
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={() => value.trim().length >= 3 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="e.g. Jalingo, Taraba State, Nigeria"
          className="h-11 pr-9"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-faint" />
        )}

        {open && (suggestions.length > 0 || (searched && !loading)) && (
          <div className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-md">
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  // mousedown fires before the input's blur, so the click
                  // registers before the dropdown closes itself.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(s);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-body transition-colors hover:bg-brand-soft"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-link" />
                  <span>{s.display_name}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2.5 text-sm text-faint">No matches — try a different search</p>
            )}
          </div>
        )}
      </div>

      {hasPin && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-line">
          <iframe
            title="Location preview"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude! - 0.01},${latitude! - 0.01},${longitude! + 0.01},${latitude! + 0.01}&layer=mapnik&marker=${latitude},${longitude}`}
            className="h-40 w-full"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
