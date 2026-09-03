"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  AnalyticsEvent,
  AnalyticsEventName,
  ApprovalRecord,
  BudgetLine,
  CampaignProposal,
  ChannelId,
  CompanyProfile,
  CreativeAsset,
  GrowthObjective,
  GuardrailFinding,
  GuardrailResolution,
  PlanStage,
} from "@/lib/types";
import { assessCompleteness } from "@/lib/engine/context";
import { buildOutcome } from "@/lib/engine/outcome";
import { applyFix, reviewCreative } from "@/lib/engine/guardrails";
import { recomputeAllocation, reflowShares, withAmounts } from "@/lib/engine/budget";
import {
  audit,
  createPlan,
  revokeApproval,
  editCount,
  markStage,
  newId,
  planVersion,
  recompute,
  recordOverride,
  selectedRecommendations,
} from "./plan";
import { seedHistory } from "./seed";

/**
 * The growth-plan workspace.
 *
 * State lives in the browser and is written to localStorage on every change.
 * That is a deliberate choice for a demo product: a live presentation should
 * not be able to fail because a database connection dropped in a lecture
 * theatre. Every write goes through `persist`, so swapping the adapter for a
 * SQLite- or Postgres-backed API is a change in one function, not a rewrite.
 */

const STORAGE_KEY = "growthos.workspace.v2";

export interface Settings {
  approverName: string;
  showDemoBanner: boolean;
}

interface WorkspaceState {
  plans: CampaignProposal[];
  activePlanId: string | null;
  analytics: AnalyticsEvent[];
  settings: Settings;
}

const DEFAULT_SETTINGS: Settings = { approverName: "Demo User", showDemoBanner: true };

function freshState(): WorkspaceState {
  return {
    plans: seedHistory(),
    activePlanId: null,
    analytics: [],
    settings: DEFAULT_SETTINGS,
  };
}

function load(): WorkspaceState {
  if (typeof window === "undefined") return freshState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    if (!Array.isArray(parsed.plans)) return freshState();
    return {
      plans: parsed.plans,
      activePlanId: parsed.activePlanId ?? null,
      analytics: Array.isArray(parsed.analytics) ? parsed.analytics : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    // A corrupted workspace must never take the demo down with it.
    return freshState();
  }
}

function persist(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — the session continues in memory */
  }
}

/* -------------------------------------------------------------------------- */

interface WorkspaceApi {
  ready: boolean;
  plans: CampaignProposal[];
  plan: CampaignProposal | null;
  settings: Settings;
  analytics: AnalyticsEvent[];

  track: (name: AnalyticsEventName, props?: AnalyticsEvent["props"]) => void;

  startPlan: (company: CompanyProfile | null) => void;
  openPlan: (id: string) => void;
  setCompany: (company: CompanyProfile) => void;
  completeStage: (stage: PlanStage) => void;

  setObjective: (objective: GrowthObjective) => void;
  confirmObjective: () => void;

  selectSegments: (ids: string[], reason?: string) => void;

  setChannelShare: (channelId: ChannelId, sharePct: number, locked: Set<ChannelId>) => void;
  setBudgetTotal: (totalINR: number) => void;
  resetBudgetToRecommendation: () => void;
  commitBudget: (reason?: string) => void;

  updateCreative: (id: string, patch: Partial<CreativeAsset>) => void;
  setCreativeStatus: (id: string, status: CreativeAsset["status"]) => void;

  resolveFinding: (
    findingId: string,
    resolution: GuardrailResolution,
    options?: { overrideReason?: string; newText?: string },
  ) => void;

  approvePlan: (approvedBy: string, note: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetDemo: () => void;
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  // Read by callbacks that need the current plan to classify their own event.
  const stateRef = React.useRef<WorkspaceState | null>(null);

  // Hydrate on the client only: the workspace depends on localStorage and on
  // the current date, neither of which exists during server rendering.
  useEffect(() => {
    setState(load());
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const update = useCallback((fn: (s: WorkspaceState) => WorkspaceState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const updatePlan = useCallback(
    (fn: (plan: CampaignProposal) => CampaignProposal) => {
      update((s) => {
        if (!s.activePlanId) return s;
        return {
          ...s,
          plans: s.plans.map((p) => (p.id === s.activePlanId ? fn(p) : p)),
        };
      });
    },
    [update],
  );

  const track = useCallback<WorkspaceApi["track"]>(
    (name, props) => {
      update((s) => ({
        ...s,
        analytics: [
          ...s.analytics,
          {
            id: newId("evt"),
            name,
            at: new Date().toISOString(),
            planId: s.activePlanId,
            props,
          },
        ].slice(-500),
      }));
    },
    [update],
  );

  /* ---------------------------------------------------------------- plans */

  const startPlan = useCallback<WorkspaceApi["startPlan"]>(
    (company) => {
      const plan = createPlan(company);
      update((s) => ({ ...s, plans: [plan, ...s.plans], activePlanId: plan.id }));
    },
    [update],
  );

  const openPlan = useCallback<WorkspaceApi["openPlan"]>(
    (id) => update((s) => ({ ...s, activePlanId: id })),
    [update],
  );

  const setCompany = useCallback<WorkspaceApi["setCompany"]>(
    (company) => {
      updatePlan((plan) => {
        const next: CampaignProposal = {
          ...plan,
          company,
          completeness: assessCompleteness(company),
          title: `${company.name || "Untitled brand"} — ${plan.cycleLabel}`,
        };
        const withAudit = audit(
          next,
          "user",
          "Company context updated",
          `${company.name || "Untitled brand"} — ${assessCompleteness(company).scorePct}% context completeness.`,
        );
        return next.objective ? recompute(withAudit) : withAudit;
      });
    },
    [updatePlan],
  );

  const completeStage = useCallback<WorkspaceApi["completeStage"]>(
    (stage) => updatePlan((plan) => markStage(plan, stage)),
    [updatePlan],
  );

  /* ------------------------------------------------------------ objective */

  const setObjective = useCallback<WorkspaceApi["setObjective"]>(
    (objective) => {
      updatePlan((plan) => {
        const changed =
          plan.objective &&
          (plan.objective.presetId !== objective.presetId ||
            plan.objective.rawText !== objective.rawText ||
            plan.objective.monthlyBudgetINR !== objective.monthlyBudgetINR);

        let next: CampaignProposal = { ...plan, objective };
        if (changed && plan.objective) {
          next = recordOverride(next, {
            kind: "objective",
            summary: "Objective changed",
            detail:
              "The segment ranking, strategy, budget and creative were regenerated against the new objective.",
            aiValue: plan.objective.rawText,
            userValue: objective.rawText,
          });
          // A new question deserves a new answer, not a carried-forward one.
          next = { ...next, selectedSegmentIds: [], approval: null, status: "draft" };
        }
        return recompute(next, { resetDownstream: Boolean(changed) });
      });
    },
    [updatePlan],
  );

  const confirmObjective = useCallback(() => {
    updatePlan((plan) => {
      if (!plan.objective) return plan;
      const next = recompute(
        { ...plan, objective: { ...plan.objective, confirmed: true } },
        { resetDownstream: false },
      );
      return markStage(
        audit(next, "user", "Objective confirmed", next.objective!.interpretation),
        "objective",
      );
    });
    track("objective_confirmed");
  }, [updatePlan, track]);

  /* ------------------------------------------------------------- segments */

  const selectSegments = useCallback<WorkspaceApi["selectSegments"]>(
    (ids, reason) => {
      updatePlan((plan) => {
        const recommended = plan.segmentRecommendations.find((s) => s.recommended);
        const isOverride =
          Boolean(recommended) && (ids.length !== 1 || ids[0] !== recommended!.segmentId);

        let next: CampaignProposal = { ...plan, selectedSegmentIds: ids };
        if (isOverride && recommended) {
          const chosen = ids
            .map((id) => plan.segmentRecommendations.find((s) => s.segmentId === id)?.segment.name)
            .filter(Boolean)
            .join(", ");
          next = recordOverride(next, {
            kind: "segment",
            summary: `Segment override: ${chosen || "none"} selected instead of ${recommended.segment.name}`,
            detail:
              "GrowthOS recalculated the channel mix, budget and creative against the segment the user chose.",
            aiValue: recommended.segment.name,
            userValue: chosen || "none",
            reason,
          });
        } else {
          next = audit(
            next,
            "user",
            "Segment selected",
            `Accepted the recommended segment${ids.length > 1 ? "s" : ""}.`,
          );
        }
        // The whole point of overriding is that the plan actually changes.
        return markStage(recompute(next, { resetDownstream: true }), "segments");
      });
      track(
        (() => {
          const plan = stateRef.current?.plans.find((p) => p.id === stateRef.current?.activePlanId);
          const rec = plan?.segmentRecommendations.find((s) => s.recommended);
          return rec && (ids.length !== 1 || ids[0] !== rec.segmentId)
            ? "segment_overridden"
            : "segment_accepted";
        })(),
        { count: ids.length },
      );
    },
    [updatePlan, track],
  );

  /* --------------------------------------------------------------- budget */

  const withRecomputedBudget = useCallback(
    (plan: CampaignProposal, lines: BudgetLine[]): CampaignProposal => {
      if (!plan.company || !plan.objective || !plan.recommendedAllocation || !plan.strategy) {
        return plan;
      }
      const total = plan.finalAllocation?.totalBudgetINR ?? plan.objective.monthlyBudgetINR;
      const base = revokeApproval(
        plan,
        "The budget allocation was changed after approval.",
      );
      return {
        ...base,
        finalAllocation: recomputeAllocation(
          lines,
          plan.recommendedAllocation,
          plan.company,
          plan.objective,
          selectedRecommendations(plan.segmentRecommendations, plan.selectedSegmentIds),
          total,
          plan.strategy.confidence,
        ),
        // Changing the split invalidates a band that described a different split.
        outcome: null,
        updatedAt: new Date().toISOString(),
      };
    },
    [],
  );

  const setChannelShare = useCallback<WorkspaceApi["setChannelShare"]>(
    (channelId, sharePct, locked) => {
      updatePlan((plan) => {
        if (!plan.finalAllocation) return plan;
        const next = reflowShares(plan.finalAllocation.lines, channelId, sharePct, locked);
        return withRecomputedBudget(plan, next);
      });
    },
    [updatePlan, withRecomputedBudget],
  );

  const setBudgetTotal = useCallback<WorkspaceApi["setBudgetTotal"]>(
    (totalINR) => {
      updatePlan((plan) => {
        if (!plan.finalAllocation || !plan.company || !plan.objective || !plan.strategy) return plan;
        const lines = withAmounts(plan.finalAllocation.lines, totalINR);
        const base = revokeApproval(plan, "The total budget was changed after approval.");
        return {
          ...base,
          objective: { ...plan.objective, monthlyBudgetINR: totalINR },
          finalAllocation: recomputeAllocation(
            lines,
            plan.recommendedAllocation ?? plan.finalAllocation,
            plan.company,
            { ...plan.objective, monthlyBudgetINR: totalINR },
            selectedRecommendations(plan.segmentRecommendations, plan.selectedSegmentIds),
            totalINR,
            plan.strategy.confidence,
          ),
          outcome: null,
        };
      });
    },
    [updatePlan],
  );

  const resetBudgetToRecommendation = useCallback(() => {
    updatePlan((plan) => {
      if (!plan.recommendedAllocation) return plan;
      const base = revokeApproval(plan, "The budget allocation was reset after approval.");
      return audit(
        { ...base, finalAllocation: base.recommendedAllocation, outcome: null },
        "user",
        "Budget reset",
        "Returned the allocation to the modelled recommendation.",
      );
    });
  }, [updatePlan]);

  const commitBudget = useCallback<WorkspaceApi["commitBudget"]>(
    (reason) => {
      updatePlan((plan) => {
        if (!plan.finalAllocation || !plan.recommendedAllocation) return plan;
        const deltas = plan.finalAllocation.lines
          .map((l) => {
            const rec = plan.recommendedAllocation!.lines.find((r) => r.channelId === l.channelId);
            const delta = l.sharePct - (rec?.sharePct ?? 0);
            return delta === 0
              ? null
              : `${l.channelName} ${delta > 0 ? "+" : ""}${delta} pts`;
          })
          .filter(Boolean) as string[];

        let next = plan;
        if (deltas.length > 0) {
          next = recordOverride(plan, {
            kind: "budget",
            summary: `Budget override: ${deltas.join(", ")}`,
            detail: `Human allocation differs from the modelled recommendation by ${plan.finalAllocation.impact.deviationFromRecommendationPts} percentage points in total.`,
            aiValue: plan.recommendedAllocation.lines
              .map((l) => `${l.channelName} ${l.sharePct}%`)
              .join(" / "),
            userValue: plan.finalAllocation.lines
              .map((l) => `${l.channelName} ${l.sharePct}%`)
              .join(" / "),
            reason,
          });
        } else {
          next = audit(plan, "user", "Budget confirmed", "Accepted the modelled allocation unchanged.");
        }
        return markStage(next, "budget");
      });
      track("budget_changed");
    },
    [updatePlan, track],
  );

  /* ------------------------------------------------------------- creative */

  const updateCreative = useCallback<WorkspaceApi["updateCreative"]>(
    (id, patch) => {
      updatePlan((plan) => {
        const creatives = plan.creatives.map((c) => (c.id === id ? { ...c, ...patch } : c));
        return { ...plan, creatives, updatedAt: new Date().toISOString() };
      });
    },
    [updatePlan],
  );

  const setCreativeStatus = useCallback<WorkspaceApi["setCreativeStatus"]>(
    (id, status) => {
      updatePlan((plan) => {
        const creative = plan.creatives.find((c) => c.id === id);
        const creatives = plan.creatives.map((c) => (c.id === id ? { ...c, status } : c));
        return audit(
          { ...plan, creatives },
          "user",
          `Creative ${status}`,
          `${creative?.channelLabel ?? "Creative"} — "${creative?.headline ?? ""}"`,
        );
      });
      if (status === "approved") track("creative_approved");
    },
    [updatePlan, track],
  );

  /* ----------------------------------------------------------- guardrails */

  const resolveFinding = useCallback<WorkspaceApi["resolveFinding"]>(
    (findingId, resolution, options) => {
      updatePlan((plan) => {
        if (!plan.guardrailReport) return plan;
        const finding = plan.guardrailReport.findings.find((f) => f.id === findingId);
        if (!finding) return plan;

        let creatives = plan.creatives;
        if (resolution === "fix-accepted" || resolution === "manually-edited") {
          creatives = plan.creatives.map((c) => {
            if (c.id !== finding.creativeId) return c;
            const nextText =
              resolution === "manually-edited"
                ? (options?.newText ?? "")
                : applyFix(c, finding);
            return { ...c, [finding.field]: nextText, status: "edited" as const };
          });
        }

        const marked: GuardrailFinding[] = plan.guardrailReport.findings.map((f) =>
          f.id === findingId
            ? {
                ...f,
                resolution,
                overrideReason: options?.overrideReason,
                resolvedAt: new Date().toISOString(),
              }
            : f,
        );

        // Re-check the creative that changed. A fix often clears more than the
        // one finding it was accepted for, and it can introduce a new one —
        // leaving a stale flag on copy that no longer says the flagged thing
        // would make the review untrustworthy in exactly the wrong direction.
        const edited = creatives.find((c) => c.id === finding.creativeId);
        const rescan = edited && creatives !== plan.creatives ? reviewCreative(edited) : null;

        let clearedBySideEffect = 0;
        const findings: GuardrailFinding[] = rescan
          ? [
              ...marked.filter((f) => f.creativeId !== finding.creativeId),
              ...marked.filter((f) => {
                if (f.creativeId !== finding.creativeId) return false;
                if (f.resolution !== "unresolved") return true; // keep the record
                const stillThere = rescan.some((r) => r.id === f.id);
                if (!stillThere) clearedBySideEffect += 1;
                return stillThere;
              }),
              // Anything the edit newly introduced.
              ...rescan.filter((r) => !marked.some((f) => f.id === r.id)),
            ]
          : marked;

        const report = {
          ...plan.guardrailReport,
          findings,
          warningCount: findings.filter((f) => f.severity === "warning").length,
          blockCount: findings.filter((f) => f.severity === "block").length,
        };

        let next: CampaignProposal = { ...plan, creatives, guardrailReport: report };

        if (clearedBySideEffect > 0) {
          next = audit(
            next,
            "growthos",
            "Findings re-checked after edit",
            `${clearedBySideEffect} further finding(s) on ${finding.creativeLabel} no longer apply to the revised copy and were cleared.`,
          );
        }

        if (resolution === "overridden") {
          next = recordOverride(next, {
            kind: "guardrail",
            summary: `Guardrail override — ${finding.categoryLabel} (${finding.ruleId})`,
            detail: `"${finding.detectedText}" kept as written on ${finding.creativeLabel}.`,
            aiValue: finding.suggestedCorrection,
            userValue: finding.detectedText,
            reason: options?.overrideReason,
          });
        } else {
          next = audit(
            next,
            "user",
            `Guardrail ${resolution === "fix-accepted" ? "fix accepted" : "manually edited"}`,
            `${finding.ruleId} ${finding.categoryLabel} on ${finding.creativeLabel}.`,
          );
        }
        return next;
      });
      track(resolution === "overridden" ? "guardrail_overridden" : "guardrail_triggered", {
        findingId,
      });
    },
    [updatePlan, track],
  );

  /* ------------------------------------------------------------- approval */

  const approvePlan = useCallback<WorkspaceApi["approvePlan"]>(
    (approvedBy, note) => {
      updatePlan((plan) => {
        if (!plan.company || !plan.objective || !plan.strategy || !plan.finalAllocation) return plan;
        const record: ApprovalRecord = {
          approvedBy: approvedBy.trim() || "Demo User",
          approvedAt: new Date().toISOString(),
          version: planVersion(plan),
          editCount: editCount(plan),
          overrideCount: plan.overrides.length,
          acknowledgedResponsibility: true,
          note: note.trim() || undefined,
        };
        const outcome = buildOutcome(
          plan.company,
          plan.objective,
          plan.strategy,
          selectedRecommendations(plan.segmentRecommendations, plan.selectedSegmentIds),
          plan.finalAllocation,
          plan.recommendedAllocation ?? plan.finalAllocation,
        );
        const next: CampaignProposal = {
          ...plan,
          approval: record,
          outcome,
          status: "approved",
        };
        return markStage(
          markStage(
            audit(
              next,
              "user",
              "Growth plan approved",
              `Approved by ${record.approvedBy}. ${record.editCount} edit(s), ${record.overrideCount} override(s).`,
            ),
            "approval",
          ),
          "outcome",
        );
      });
      track("proposal_approved");
    },
    [updatePlan, track],
  );

  /* ------------------------------------------------------------- settings */

  const updateSettings = useCallback<WorkspaceApi["updateSettings"]>(
    (patch) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    [update],
  );

  const resetDemo = useCallback(() => {
    const next = freshState();
    persist(next);
    setState(next);
  }, []);

  const plan = useMemo(
    () => state?.plans.find((p) => p.id === state.activePlanId) ?? null,
    [state],
  );

  const api = useMemo<WorkspaceApi>(
    () => ({
      ready: state !== null,
      plans: state?.plans ?? [],
      plan,
      settings: state?.settings ?? DEFAULT_SETTINGS,
      analytics: state?.analytics ?? [],
      track,
      startPlan,
      openPlan,
      setCompany,
      completeStage,
      setObjective,
      confirmObjective,
      selectSegments,
      setChannelShare,
      setBudgetTotal,
      resetBudgetToRecommendation,
      commitBudget,
      updateCreative,
      setCreativeStatus,
      resolveFinding,
      approvePlan,
      updateSettings,
      resetDemo,
    }),
    [
      state,
      plan,
      track,
      startPlan,
      openPlan,
      setCompany,
      completeStage,
      setObjective,
      confirmObjective,
      selectSegments,
      setChannelShare,
      setBudgetTotal,
      resetBudgetToRecommendation,
      commitBudget,
      updateCreative,
      setCreativeStatus,
      resolveFinding,
      approvePlan,
      updateSettings,
      resetDemo,
    ],
  );

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside a WorkspaceProvider.");
  return ctx;
}
