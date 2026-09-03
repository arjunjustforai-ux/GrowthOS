"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Logo";
import { Badge, Button, Modal, cx } from "@/components/ui";
import { useWorkspace } from "@/lib/store/workspace";

const NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/plan/context", label: "New Growth Plan", match: (p: string) => p.startsWith("/plan") },
  { href: "/history", label: "Decision History", match: (p: string) => p.startsWith("/history") || p.startsWith("/proposal") },
  { href: "/data", label: "Data", match: (p: string) => p.startsWith("/data") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") || p.startsWith("/admin") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { plan, settings, resetDemo, ready } = useWorkspace();
  const [confirmReset, setConfirmReset] = React.useState(false);

  const isProposal = pathname.startsWith("/proposal");

  return (
    <div className="min-h-screen lg:flex">
      <aside
        data-app-nav
        className="sticky top-0 z-30 border-b border-line bg-ivory-50/90 backdrop-blur lg:h-screen lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4 lg:block">
            <Link href="/" aria-label="GrowthOS home">
              <Wordmark />
            </Link>
            <p className="hidden pt-3 text-xs leading-relaxed text-navy-400 lg:block">
              AI drafts the argument.
              <br />
              You make the call.
            </p>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-4 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-white text-navy-800 shadow-card lg:shadow-none lg:bg-navy-800 lg:text-ivory-100"
                      : "text-navy-500 hover:bg-ivory-200 hover:text-navy-700",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto hidden px-5 pb-5 lg:block">
            {ready && plan?.company?.isDemo && settings.showDemoBanner ? (
              <div className="mb-3 rounded-card border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-amber-600">
                  Demo dataset
                </p>
                <p className="mt-1 text-xs leading-relaxed text-navy-500">
                  Simulated figures for product demonstration. Not real customer evidence.
                </p>
              </div>
            ) : null}
            <Button size="sm" variant="ghost" className="w-full" onClick={() => setConfirmReset(true)}>
              Reset demo
            </Button>
          </div>
        </div>
      </aside>

      <main className={cx("min-w-0 flex-1", isProposal ? "print-full" : "")}>{children}</main>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the demo?"
        description="This clears every plan, override and analytics event from this browser and returns GrowthOS to its initial presentation state. The two seeded historical plans are rebuilt."
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
                window.location.href = "/";
              }}
            >
              Reset demo
            </Button>
          </>
        }
      />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="border-b border-line bg-white/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 py-7 sm:px-8">
        <div className="max-w-prose">
          {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="font-serif text-[30px] leading-[1.15] tracking-[-0.01em] text-navy-800">
            {title}
          </h1>
          {description ? (
            <p className="mt-2.5 text-sm leading-relaxed text-navy-400">{description}</p>
          ) : null}
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div> : null}
      </div>
    </header>
  );
}

export function DemoDataNotice() {
  return (
    <Badge tone="amber" className="normal-case tracking-normal">
      Demo dataset — simulated for product demonstration
    </Badge>
  );
}
