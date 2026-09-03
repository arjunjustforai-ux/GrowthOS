import React from "react";

/**
 * The GrowthOS mark: three ascending steps inside a rounded square, with the
 * final step in amber — a decision taken, not a trend line extrapolated.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#0F1B2D" />
      <rect x="7" y="18" width="4.5" height="7" rx="1.25" fill="#8494AE" />
      <rect x="13.75" y="13" width="4.5" height="12" rx="1.25" fill="#4F73E3" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="1.25" fill="#DFB960" />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logo size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-navy-800">
        Growth<span className="text-accent-600">OS</span>
      </span>
    </span>
  );
}
