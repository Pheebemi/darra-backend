"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type FaqItem = {
  q: string;
  a: string;
};

export type FaqSection = {
  title: string;
  items: FaqItem[];
};

export function FaqAccordion({ sections }: { sections: FaqSection[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <div key={section.title}>
          <h2 className="mb-3 text-lg font-semibold text-ink">{section.title}</h2>
          <div className="space-y-2.5">
            {section.items.map((item) => {
              const id = `${section.title}-${item.q}`;
              const isOpen = openId === id;
              return (
                <div
                  key={id}
                  className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-ink transition-colors hover:bg-brand-soft"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-accent-link transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm leading-relaxed text-body">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
