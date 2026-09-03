"use client";

import React from "react";
import type { ReasoningNode } from "@/lib/types";
import { Badge, Card, Chevron, cx } from "@/components/ui";

/**
 * The reasoning trace.
 *
 * Open by default, every time. The entire product thesis is that a marketing
 * lead can be asked "why?" and answer line by line — so the answer cannot live
 * behind a "Why?" button that nobody presses during a demo, or during a board
 * meeting.
 *
 * Each node reads INPUT → INTERPRETATION → DECISION, in that order, because
 * that is the order the argument has to be defended in.
 */

const TOPIC_LABEL: Record<ReasoningNode["topic"], string> = {
  segment: "Segment",
  channel: "Channel",
  budget: "Budget",
  objective: "Objective",
  risk: "Risk",
  creative: "Creative",
};

export function ReasoningTrace({
  nodes,
  onOpen,
  className,
  dense = false,
}: {
  nodes: ReasoningNode[];
  onOpen?: () => void;
  className?: string;
  dense?: boolean;
}) {
  React.useEffect(() => {
    if (nodes.length > 0) onOpen?.();
    // Fires once per mount: the trace is open on arrival, so arriving is opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (nodes.length === 0) return null;

  return (
    <div className={cx("space-y-3", className)}>
      {nodes.map((node) => (
        <ReasoningCard key={node.id} node={node} dense={dense} />
      ))}
    </div>
  );
}

function ReasoningCard({ node, dense }: { node: ReasoningNode; dense: boolean }) {
  const [open, setOpen] = React.useState(true);

  return (
    <Card className={cx("overflow-hidden", dense ? "px-4 py-3.5" : "px-5 py-4")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Chevron open={open} />
          <span className="truncate text-sm font-medium text-navy-800">{node.input}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge tone="outline">{TOPIC_LABEL[node.topic]}</Badge>
          <span className="tnum text-2xs font-semibold text-navy-400">
            {Math.round(node.confidence * 100)}%
          </span>
        </span>
      </button>

      {open ? (
        <div className="mt-4 animate-fade-up">
          <div className="grid gap-0 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
            <TraceCell label="Input" body={node.input} note={node.comparison} tone="input" />
            <Arrow />
            <TraceCell label="Interpretation" body={node.interpretation} tone="interpretation" />
            <Arrow />
            <TraceCell label="Decision" body={node.decision} tone="decision" />
          </div>

          {node.wouldChangeIf.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-amber-600">
                What would change this
              </p>
              <ul className="mt-2 space-y-1.5">
                {node.wouldChangeIf.map((w) => (
                  <li key={w} className="flex gap-2 text-[13px] leading-relaxed text-navy-600">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function TraceCell({
  label,
  body,
  note,
  tone,
}: {
  label: string;
  body: string;
  note?: string;
  tone: "input" | "interpretation" | "decision";
}) {
  return (
    <div
      className={cx(
        "rounded-lg border px-3.5 py-3",
        tone === "input"
          ? "border-line bg-ivory-50"
          : tone === "interpretation"
            ? "border-line bg-white"
            : "border-accent-100 bg-accent-50/60",
      )}
    >
      <p
        className={cx(
          "text-2xs font-semibold uppercase tracking-[0.1em]",
          tone === "decision" ? "text-accent-600" : "text-navy-400",
        )}
      >
        {label}
      </p>
      <p
        className={cx(
          "mt-1.5 text-[13px] leading-relaxed",
          tone === "decision" ? "font-medium text-navy-800" : "text-navy-600",
        )}
      >
        {body}
      </p>
      {note ? <p className="mt-1.5 text-xs leading-relaxed text-navy-400">{note}</p> : null}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center py-2 sm:px-2 sm:py-0">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="text-navy-200 rotate-90 sm:rotate-0">
        <path
          d="M2 8h11m0 0-3.5-3.5M13 8l-3.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** Mandatory on the strategy screen. Never collapsed. */
export function WouldChangeThis({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="border-amber-200 bg-amber-50/70 px-5 py-4">
      <h3 className="font-serif text-lg text-navy-800">What would change this recommendation?</h3>
      <p className="mt-1 text-sm leading-relaxed text-navy-500">
        Every one of these is checkable against next month&rsquo;s numbers. If one of them happens,
        this plan should be rebuilt rather than defended.
      </p>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-navy-700">
            <span
              aria-hidden
              className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full border border-amber-400 bg-white"
            />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}
