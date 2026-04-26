import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import type { ProtocolStep, ReviewCreateRequest } from "../api/types";
import { WorkspaceStepper } from "../components/fulcrum/WorkspaceStepper";
import StatusPill from "../components/StatusPill";
import { noveltyLabelTag, noveltyStatCounts, noveltyToPaperRows } from "../lib/planAdapters";
import { isStepAccessible, parseWorkspaceStep } from "../lib/workspaceSteps";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function SegBar({ scorePct }: { scorePct: number }) {
  const total = 20;
  const on = Math.round((scorePct / 100) * total);
  return (
    <div className="fu-seg-row mb-3">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`fu-seg ${i < on ? "bg-black" : "bg-[#E0E0DC]"}`} />
      ))}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

/** Minimal toast rendered inside a page */
function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-md bg-black px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white shadow-xl">
      {msg}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step-transition overlay
// ---------------------------------------------------------------------------

function StepOverlay({ visible, msg }: { visible: boolean; msg: string }) {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
      style={{ background: "rgba(240,240,236,.92)" }}
    >
      <div className="fu-spin h-8 w-8 rounded-full border-2 border-fu-border border-t-black" />
      <div className="flex gap-1">
        <div className="fu-db1 h-1.5 w-1.5 rounded-full bg-black" />
        <div className="fu-db2 h-1.5 w-1.5 rounded-full bg-black" />
        <div className="fu-db3 h-1.5 w-1.5 rounded-full bg-black" />
      </div>
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-fu-t3">{msg}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspacePage
// ---------------------------------------------------------------------------

export default function WorkspacePage() {
  const { experimentId = "", step: stepParam } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [overlayMsg, setOverlayMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }

  function navigateTo(path: string, msg = "Loading…") {
    setOverlayMsg(msg);
    setTimeout(() => {
      setOverlayMsg(null);
      navigate(path);
    }, 600);
  }

  if (!stepParam) {
    return <Navigate to={`/workspace/${experimentId}/literature`} replace />;
  }
  const step = parseWorkspaceStep(stepParam);
  if (!step) {
    return <Navigate to={`/workspace/${experimentId}/literature`} replace />;
  }

  const detail = useQuery({
    queryKey: ["experiment", experimentId],
    queryFn: () => api.getExperiment(experimentId),
    enabled: Boolean(experimentId),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 3000;
      if (d.experiment.status === "QUEUED" || d.experiment.status === "RUNNING") return 3000;
      return false;
    },
  });

  useEffect(() => {
    if (!detail.data) return;
    if (!isStepAccessible(step, detail.data)) {
      navigate(`/workspace/${experimentId}/literature`, { replace: true });
    }
  }, [detail.data, step, experimentId, navigate]);

  if (detail.isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-fu-bg text-sm text-fu-t3">
        <div className="fu-spin mr-2.5 h-5 w-5 rounded-full border-2 border-fu-border border-t-black" />
        Loading experiment…
      </div>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <div className="p-8 text-sm text-fu-red">
        {(detail.error as Error)?.message || "Not found"}{" "}
        <Link to="/" className="underline">
          Home
        </Link>
      </div>
    );
  }

  const data = detail.data;

  return (
    <div className="flex h-full min-h-0 flex-col bg-fu-bg">
      <WorkspaceStepper experimentId={experimentId} currentStep={step} detail={data} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {step === "hypothesis" && (
          <HypothesisStep experimentId={experimentId} data={data} toast={toast} />
        )}
        {step === "literature" && (
          <LiteratureStep
            experimentId={experimentId}
            data={data}
            qc={qc}
            toast={toast}
            navigateTo={navigateTo}
          />
        )}
        {step === "planning" && (
          <PlanningStep
            data={data}
            experimentId={experimentId}
            qc={qc}
            toast={toast}
            navigateTo={navigateTo}
          />
        )}
        {step === "summary" && (
          <SummaryStep experimentId={experimentId} data={data} qc={qc} toast={toast} />
        )}
      </div>
      <StepOverlay visible={Boolean(overlayMsg)} msg={overlayMsg ?? ""} />
      <Toast msg={toastMsg} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HypothesisStep
// ---------------------------------------------------------------------------

function HypothesisStep({
  experimentId,
  data,
  toast,
}: {
  experimentId: string;
  data: import("../api/types").ExperimentDetailResponse;
  toast: (m: string) => void;
}) {
  const qc = useQueryClient();
  const { experiment } = data;
  const [hypothesis, setHypothesis] = useState(experiment.hypothesis);
  const [domain, setDomain] = useState(experiment.domain ?? "");

  const patch = useMutation({
    mutationFn: () =>
      api.patchExperiment(experimentId, {
        hypothesis: hypothesis.trim(),
        domain: domain.trim() || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["experiment", experimentId] });
      toast("Hypothesis saved.");
    },
  });

  return (
    <div className="mx-auto max-w-[800px] px-8 py-8">
      <div className="mb-5">
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
          Step 1 of 4 · Hypothesis
        </div>
        <h2 className="font-mono text-[22px] font-bold tracking-tight">Your Hypothesis</h2>
        <p className="mt-1 text-xs text-fu-t3">Edit and save before re-running the pipeline.</p>
      </div>

      <div className="fu-card border-[1.5px] border-black">
        <div
          className="fu-dot-grid border-b px-[18px] pb-3 pt-[18px]"
          style={{ borderColor: "var(--fu-border)" }}
        >
          <label className="mb-2 block text-[9px] font-bold uppercase tracking-[.12em] text-fu-t4">
            Hypothesis
          </label>
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            rows={5}
            className="w-full resize-none border-0 bg-transparent text-[13px] leading-relaxed text-fu-text focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between bg-[#FAFAF8] px-[18px] py-2.5">
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="cursor-pointer border-0 bg-transparent text-[10px] font-bold uppercase tracking-wider text-fu-t3 focus:outline-none"
          >
            <option value="">Select domain</option>
            <option value="Cell Biology">Cell Biology</option>
            <option value="Diagnostics">Diagnostics</option>
            <option value="Gut Health">Gut Health</option>
            <option value="Climate Science">Climate Science</option>
            <option value="Neuroscience">Neuroscience</option>
          </select>
          <button
            type="button"
            disabled={patch.isPending || hypothesis.trim().length < 10}
            onClick={() => patch.mutate()}
            className="rounded-md bg-black px-[18px] py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
          >
            {patch.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiteratureStep
// ---------------------------------------------------------------------------

function LiteratureStep({
  experimentId,
  data,
  qc,
  toast,
  navigateTo,
}: {
  experimentId: string;
  data: import("../api/types").ExperimentDetailResponse;
  qc: ReturnType<typeof useQueryClient>;
  toast: (m: string) => void;
  navigateTo: (path: string, msg?: string) => void;
}) {
  const { experiment, latest_plan, agent_runs } = data;
  const novelty = latest_plan?.novelty;
  const papers = useMemo(() => noveltyToPaperRows(novelty), [novelty]);
  const stats = useMemo(() => noveltyStatCounts(novelty), [novelty]);
  const tag = novelty
    ? noveltyLabelTag(novelty.label)
    : { text: "Running…", variant: "amber" as const };
  const scorePct = novelty ? Math.round((novelty.confidence ?? 0) * 100) : 0;

  const [hypothesis, setHypothesis] = useState(experiment.hypothesis);
  const [editing, setEditing] = useState(false);

  const patch = useMutation({
    mutationFn: () =>
      api.patchExperiment(experimentId, { hypothesis: hypothesis.trim(), domain: experiment.domain }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["experiment", experimentId] });
      toast("Hypothesis saved.");
    },
  });

  const running = experiment.status === "RUNNING" || experiment.status === "QUEUED";
  const noveltyRun = agent_runs.find((r) => r.agent_name === "novelty");

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-7">
      {/* Page header */}
      <div className="fu mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
            Step 2 of 4 · Literature check
          </div>
          <h2 className="font-mono text-[22px] font-bold tracking-tight">Literature Review</h2>
          <p className="mt-1 text-xs text-fu-t3">
            Prior work signal from the novelty agent. Refine your hypothesis if needed.
          </p>
        </div>
        <div
          className={`fu1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 ${
            tag.variant === "red"
              ? "fu-tag-red"
              : tag.variant === "green"
                ? "fu-tag-green"
                : "fu-tag-amber"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="text-[9px] font-bold uppercase tracking-wide">{tag.text}</span>
        </div>
      </div>

      {/* Hypothesis card */}
      <div className="fu-card mb-4 border-[1.5px] border-black">
        <div
          className="flex items-center justify-between border-b bg-[#FAFAF8] px-4 py-3"
          style={{ borderColor: "var(--fu-border)" }}
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
            Your hypothesis
          </span>
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : setEditing(true))}
            className="rounded border-[1.5px] border-black bg-transparent px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider"
          >
            {editing ? "Close" : "Edit"}
          </button>
        </div>
        <div className="p-4">
          {editing ? (
            <>
              <textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-fu-border bg-[#F8F8F4] p-2.5 text-sm"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHypothesis(experiment.hypothesis);
                    setEditing(false);
                  }}
                  className="rounded border border-fu-border px-3 py-1 text-[9px] font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={patch.isPending || hypothesis.trim().length < 10}
                  onClick={() => patch.mutate()}
                  className="rounded bg-black px-3 py-1 text-[9px] font-bold uppercase text-white disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed">{experiment.hypothesis}</p>
          )}
        </div>
      </div>

      {/* Loading state */}
      {running && noveltyRun?.status !== "SUCCEEDED" && (
        <div className="fu-card mb-4 p-6 text-center text-sm text-fu-t3">
          <div className="fu-spin mx-auto mb-2 h-6 w-6 rounded-full border-2 border-fu-border border-t-black" />
          Literature check in progress…
        </div>
      )}

      {novelty && (
        <div className="grid gap-3">
          {/* Novelty card */}
          <div className="fu-card">
            <div className="border-b px-4 py-3" style={{ borderColor: "var(--fu-border)" }}>
              <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                Novelty score
              </span>
            </div>
            <div className="p-4">
              <div className="mb-2 flex items-end gap-1">
                <span className="npop font-mono text-[52px] font-bold leading-none">{scorePct}</span>
                <span className="mb-1 font-mono text-[22px] text-fu-t4">%</span>
              </div>
              <SegBar scorePct={scorePct} />
              <p className="text-[11px] leading-snug text-fu-t3">{novelty.rationale}</p>

              {/* Stat tiles */}
              {stats.papers > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-fu-border bg-[#FAFAF8] px-3 py-2.5">
                    <div className="font-mono text-[22px] font-bold leading-none">{stats.papers}</div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                      Papers
                    </div>
                  </div>
                  <div className="rounded-md border border-fu-border bg-[#FAFAF8] px-3 py-2.5">
                    <div className="font-mono text-[22px] font-bold leading-none">
                      {stats.highMatch}
                    </div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                      High match
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Papers card */}
          <div className="fu-card">
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "var(--fu-border)" }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                Matched papers
              </span>
              <button
                type="button"
                className="text-[9px] font-bold uppercase tracking-wider text-fu-t3 hover:text-black"
              >
                View all →
              </button>
            </div>
            <div className="flex flex-col p-2">
              {papers.map((p, i) => (
                <div key={i} className="fu-paper-row">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 text-[11px] font-medium leading-snug text-fu-t2">{p.title}</p>
                    <span
                      className="shrink-0 font-mono text-xs font-bold"
                      style={{ color: p.matchColor }}
                    >
                      {p.matchPct}%
                    </span>
                  </div>
                  {p.source && (
                    <div className="mt-0.5 text-[9px] text-fu-t4">{p.source}</div>
                  )}
                  {p.summary && (
                    <p className="mt-1 text-[10px] leading-snug text-fu-t3">{p.summary}</p>
                  )}
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[9px] text-fu-t3 underline"
                    >
                      Open source →
                    </a>
                  )}
                </div>
              ))}
              {papers.length === 0 && (
                <p className="p-2 text-xs text-fu-t4">No references returned yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="fu-action-bar mt-8">
        <Link
          to={`/workspace/${experimentId}/hypothesis`}
          className="flex items-center gap-1.5 rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-fu-t3"
        >
          Back
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-fu-t3">Review findings and continue to planning.</span>
          <button
            type="button"
            onClick={() =>
              navigateTo(
                `/workspace/${experimentId}/planning`,
                "Loading experiment planning…",
              )
            }
            className="flex items-center gap-1.5 rounded-md bg-black px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white"
          >
            Continue to experiment planning
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlanningStep
// ---------------------------------------------------------------------------

function PlanningStep({
  data,
  experimentId,
  qc,
  toast,
  navigateTo,
}: {
  data: import("../api/types").ExperimentDetailResponse;
  experimentId: string;
  qc: ReturnType<typeof useQueryClient>;
  toast: (m: string) => void;
  navigateTo: (path: string, msg?: string) => void;
}) {
  const { latest_plan, experiment } = data;
  const [tab, setTab] = useState<"protocol" | "materials" | "budget" | "timeline">("protocol");
  const protocol = latest_plan?.protocol;
  const materials = latest_plan?.materials;
  const timeline = latest_plan?.timeline;

  const patchPlan = useMutation({
    mutationFn: (body: import("../api/types").PlanPatchRequest) =>
      api.patchLatestPlan(experimentId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["experiment", experimentId] }),
  });

  const budgetTotal = materials?.budget_total;
  const running = experiment.status === "RUNNING" || experiment.status === "QUEUED";

  // Materials include/exclude state
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  function toggleExclude(i: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }
  const items = materials?.line_items ?? [];
  const includedTotal = items
    .filter((_, i) => !excluded.has(i))
    .reduce((s, li) => s + (li.unit_price ?? 0) * (li.quantity ?? 1), 0);

  // Protocol inline editing
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const steps = protocol?.steps ?? [];

  function startEditStep(i: number, text: string) {
    setEditingStepIdx(i);
    setEditingText(text);
  }
  function cancelEditStep() {
    setEditingStepIdx(null);
    setEditingText("");
  }
  function saveEditStep(i: number) {
    if (!protocol || !editingText.trim()) return;
    const nextSteps = steps.map((s, idx) =>
      idx === i ? { ...s, action: editingText.trim() } : s,
    );
    patchPlan.mutate({
      protocol: { ...protocol, steps: nextSteps } as unknown as Record<string, unknown>,
    });
    setEditingStepIdx(null);
    toast("Step saved.");
  }

  function addStep() {
    if (!protocol) return;
    const newStep: ProtocolStep = {
      step_number: steps.length + 1,
      action: "New step — click the pencil to edit.",
      inputs: [],
      conditions: null,
      expected_output: null,
      safety_notes: null,
      citations: [],
    };
    patchPlan.mutate({
      protocol: {
        ...protocol,
        steps: [...steps, newStep],
      } as unknown as Record<string, unknown>,
    });
    toast("Step added.");
  }

  // Timeline
  const phases = timeline?.phases ?? [];
  const totalDays = timeline?.critical_path_days ?? phases.reduce((s, p) => s + p.duration_days, 0);

  return (
    <div className="mx-auto max-w-[1160px] px-8 py-7">
      {/* Header */}
      <div className="fu mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
            Step 3 of 4 · Experiment planning
          </div>
          <h2 className="font-mono text-[22px] font-bold tracking-tight">Experiment Planning</h2>
          <p className="mt-1 text-xs text-fu-t3">
            One workbench for protocol, materials, budget, and timeline.
          </p>
        </div>
        {budgetTotal != null ? (
          <div className="text-right">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[.1em] text-fu-t4">
              Total budget
            </div>
            <div className="font-mono text-[36px] font-bold leading-none tracking-tight">
              {materials?.currency ?? "USD"} {budgetTotal.toLocaleString()}
            </div>
          </div>
        ) : (
          <StatusPill status={experiment.status} />
        )}
      </div>

      {running && !protocol && (
        <div className="fu-card mb-4 p-8 text-center text-sm text-fu-t3">
          <div className="fu-spin mx-auto mb-2 h-6 w-6 rounded-full border-2 border-fu-border border-t-black" />
          Agents still generating the plan…
        </div>
      )}

      {/* Single workbench card */}
      <div className="fu-card border-[1.5px] border-black overflow-visible">
        {/* Tabs header */}
        <div
          className="flex items-center gap-1 border-b bg-[#FAFAF8] px-3.5 py-2.5"
          style={{ borderColor: "var(--fu-border)" }}
        >
          {(
            [
              ["protocol", "Protocol"],
              ["materials", "Materials"],
              ["budget", "Budget"],
              ["timeline", "Timeline"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`fu-tab ${tab === id ? "active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Protocol panel */}
        {tab === "protocol" && (
          <div className="flex min-h-0 flex-col" style={{ maxHeight: 520 }}>
            {/* Sub-header */}
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "var(--fu-border)" }}
            >
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                  Protocol steps
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-fu-t3">
                  Click{" "}
                  <span className="inline-block opacity-60">
                    <PencilIcon />
                  </span>{" "}
                  on any step to edit it inline
                </div>
              </div>
              <button
                type="button"
                onClick={addStep}
                disabled={patchPlan.isPending || !protocol}
                className="flex items-center gap-1.5 rounded-md border border-fu-border bg-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-fu-t3 transition-colors hover:border-black hover:text-black disabled:opacity-40"
              >
                <svg
                  width="10"
                  height="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add step
              </button>
            </div>

            {/* Steps list */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="flex flex-col gap-[7px]">
                {steps.map((s, i) => (
                  <div
                    key={i}
                    className="group relative rounded-lg border border-fu-border bg-white px-3 py-2.5 transition-colors hover:border-[#aaa]"
                  >
                    {editingStepIdx === i ? (
                      <div>
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={3}
                          className="w-full rounded border border-fu-border bg-[#F8F8F4] p-2 text-xs"
                          autoFocus
                        />
                        <div className="mt-1.5 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEditStep(i)}
                            disabled={patchPlan.isPending}
                            className="rounded bg-black px-2.5 py-1 text-[9px] font-bold uppercase text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditStep}
                            className="rounded border border-fu-border px-2.5 py-1 text-[9px] font-bold uppercase text-fu-t3"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded bg-black font-mono text-[9px] font-bold text-white">
                          {s.step_number}
                        </div>
                        <p className="flex-1 text-xs leading-snug text-fu-t2">{s.action}</p>
                        <button
                          type="button"
                          onClick={() => startEditStep(i, s.action)}
                          className="shrink-0 text-fu-t4 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <PencilIcon />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {steps.length === 0 && (
                  <p className="text-xs text-fu-t4">No protocol steps yet.</p>
                )}
              </div>
            </div>

            {/* AI chat stub */}
            <div
              className="shrink-0 border-t"
              style={{ borderColor: "var(--fu-border)", background: "#FAFAF8", borderTopWidth: 1.5 }}
            >
              <div className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-black">
                  <svg
                    width="10"
                    height="10"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[.1em]">
                  AI Protocol Assistant
                </span>
                <span className="ml-auto rounded border border-fu-border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-fu-t4">
                  Backend pending
                </span>
              </div>
              <div className="flex gap-2 px-4 pb-3">
                <input
                  type="text"
                  disabled
                  placeholder="Refine steps, add controls, check safety, request replicates…"
                  className="flex-1 cursor-not-allowed rounded-md border border-fu-border px-3 py-2 text-[11px] text-fu-t4 opacity-60"
                />
                <button
                  type="button"
                  disabled
                  className="rounded-md bg-black px-4 py-2 text-[9px] font-bold uppercase tracking-[.1em] text-white opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Materials panel */}
        {tab === "materials" && (
          <div className="p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                  Materials inventory
                </div>
                <p className="mt-1 text-[12px] leading-snug text-fu-t3">
                  Check items the lab already has to exclude them from the budget.
                </p>
              </div>
              <div className="font-mono text-[22px] font-bold">
                {items.length - excluded.size} / {items.length}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((li, i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-opacity ${excluded.has(i) ? "border-fu-border opacity-50" : "border-fu-border hover:border-[#aaa]"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExclude(i)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] ${excluded.has(i) ? "border-[#ccc] bg-white" : "border-black bg-black"}`}
                  >
                    {!excluded.has(i) && (
                      <svg
                        width="8"
                        height="8"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-fu-t2">{li.name}</span>
                    {li.supplier && (
                      <span className="ml-2 text-[9px] text-fu-t4">{li.supplier}</span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {li.unit_price != null ? (
                      <span className="font-mono text-[11px]">
                        {li.currency} {(li.unit_price * (li.quantity ?? 1)).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-fu-t4">—</span>
                    )}
                    {excluded.has(i) && (
                      <div className="text-[9px] uppercase tracking-wider text-fu-t4">In lab</div>
                    )}
                  </div>
                </label>
              ))}
              {items.length === 0 && (
                <p className="py-4 text-center text-xs text-fu-t4">No materials yet.</p>
              )}
            </div>
          </div>
        )}

        {/* Budget panel */}
        {tab === "budget" && (
          <div className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
              {/* Line items */}
              <div>
                <div className="mb-2.5 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                  Purchasing plan
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((li, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-md border border-fu-border px-3 py-2 transition-opacity ${excluded.has(i) ? "opacity-40" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-fu-t2">{li.name}</div>
                        {li.supplier && (
                          <div className="text-[9px] text-fu-t4">{li.supplier}</div>
                        )}
                      </div>
                      {li.catalog_number && (
                        <span className="shrink-0 font-mono text-[9px] text-fu-t4">
                          {li.catalog_number}
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-[11px] font-bold">
                        {li.unit_price != null
                          ? `${li.currency} ${(li.unit_price * (li.quantity ?? 1)).toLocaleString()}`
                          : "—"}
                      </span>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="py-4 text-center text-xs text-fu-t4">No budget items yet.</p>
                  )}
                </div>
              </div>

              {/* Budget model card */}
              <div className="fu-card border-[1.5px] border-black p-4">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[.1em] text-fu-t4">
                  Budget model
                </div>
                <p className="mb-3 text-[12px] leading-snug text-fu-t2">
                  Only items marked as needed are counted. In-lab items are excluded from
                  the total.
                </p>
                <div
                  className="flex justify-between border-t pt-2.5"
                  style={{ borderColor: "var(--fu-border)" }}
                >
                  <span className="text-[12px] text-fu-t3">Purchasing subtotal</span>
                  <span className="font-mono text-[14px] font-bold">
                    {materials?.currency ?? "USD"} {includedTotal.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-[12px] text-fu-t3">Personnel estimate</span>
                  <span className="font-mono text-[14px] font-bold text-fu-t4">TBD</span>
                </div>
                {(materials?.lead_time_risks ?? []).length > 0 && (
                  <div className="mt-3 rounded-md border border-fu-border bg-[#FAFAF8] p-2.5">
                    <div className="mb-1 text-[10px] font-bold text-fu-text">Lead-time risks</div>
                    <ul className="space-y-0.5 text-[11px] text-fu-t3">
                      {materials!.lead_time_risks.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(materials?.lead_time_risks ?? []).length === 0 && (
                  <div className="mt-3 rounded-md border border-fu-border bg-[#FAFAF8] p-2.5">
                    <div className="mb-1 text-[10px] font-bold text-fu-text">
                      Cheapest acceptable default
                    </div>
                    <p className="text-[11px] leading-snug text-fu-t3">
                      The budget starts with the lowest acceptable supplier, but preserves alternates
                      for reliability.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline panel */}
        {tab === "timeline" && (
          <div>
            {/* Stats strip */}
            <div
              className="flex flex-wrap items-center justify-between gap-2.5 border-b bg-[#FAFAF8] px-4 py-3"
              style={{ borderColor: "var(--fu-border)" }}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[22px] font-bold leading-none">{totalDays}</span>
                  <span className="text-[10px] font-semibold text-fu-t3">days</span>
                </div>
                <div className="h-3.5 w-px bg-fu-border" />
                <span className="text-[10px] text-fu-t3">{phases.length} phases</span>
                {timeline?.parallelization_notes && (
                  <>
                    <div className="h-3.5 w-px bg-fu-border" />
                    <span className="text-[10px] text-fu-t3">
                      {timeline.parallelization_notes.slice(0, 60)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-2.5 rounded-sm bg-fu-amber" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                    Dependency
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-2.5 rounded-sm bg-black" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                    Primary
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-2.5 rounded-sm bg-[#B4B4B0]" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                    Support
                  </span>
                </div>
              </div>
            </div>

            {/* Gantt bars */}
            <div className="overflow-x-auto p-4">
              <div style={{ minWidth: 500 }}>
                {phases.map((ph, i) => {
                  const pct = totalDays > 0 ? (ph.duration_days / totalDays) * 100 : 0;
                  const color = ph.depends_on.length > 0 ? "var(--fu-amber)" : "#000";
                  const label = ph.parallelizable ? "Parallel" : ph.depends_on[0] ?? "Primary";
                  return (
                    <div key={i} className="mb-1.5 flex items-center gap-0">
                      <div className="w-[130px] shrink-0 pr-2.5">
                        <div className="text-[10px] font-bold leading-snug text-fu-text">
                          {ph.name}
                        </div>
                        <div className="text-[9px] text-fu-t4">{label}</div>
                      </div>
                      <div className="relative h-[30px] flex-1">
                        {/* Grid lines */}
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              "repeating-linear-gradient(90deg,transparent,transparent calc(25% - 1px),#F0F0EC calc(25% - 1px),#F0F0EC 25%)",
                          }}
                        />
                        {/* Phase bar */}
                        <div
                          title={`${ph.name}: ${ph.duration_days} days`}
                          style={{
                            position: "absolute",
                            left: 0,
                            width: `${pct}%`,
                            top: 7,
                            height: 16,
                            background: color,
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            padding: "0 6px",
                            minWidth: 28,
                          }}
                        >
                          <span
                            className="font-mono text-[8px] font-bold text-white"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {ph.duration_days}d
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {phases.length === 0 && (
                  <p className="py-4 text-center text-xs text-fu-t4">No timeline yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="fu-action-bar mt-8">
        <Link
          to={`/workspace/${experimentId}/literature`}
          className="rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-fu-t3"
        >
          Back
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (latest_plan) {
                const blob = new Blob([JSON.stringify(latest_plan, null, 2)], {
                  type: "application/json",
                });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `plan-${experimentId.slice(0, 8)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
                toast("Plan exported.");
              }
            }}
            className="rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-fu-t3"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() =>
              navigateTo(`/workspace/${experimentId}/summary`, "Loading summary…")
            }
            className="rounded-md bg-black px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white"
          >
            Go to summary
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryStep
// ---------------------------------------------------------------------------

function SummaryStep({
  experimentId,
  data,
  qc,
  toast,
}: {
  experimentId: string;
  data: import("../api/types").ExperimentDetailResponse;
  qc: ReturnType<typeof useQueryClient>;
  toast: (m: string) => void;
}) {
  const { experiment, latest_plan } = data;
  const syn = latest_plan?.synthesis;
  const novelty = latest_plan?.novelty;
  const materials = latest_plan?.materials;
  const timeline = latest_plan?.timeline;
  const validation = latest_plan?.validation;

  const readinessPct = syn ? Math.round(syn.overall_confidence * 100) : null;

  const [notes, setNotes] = useState("");
  const [includeReviews, setIncludeReviews] = useState(true);
  const [chk, setChk] = useState(false);

  const reviews = useQuery({
    queryKey: ["reviews", experimentId],
    queryFn: () => api.listReviews(experimentId),
  });

  const regenerate = useMutation({
    mutationFn: () =>
      api.regenerate(experimentId, {
        notes: notes.trim() || null,
        include_review_corrections: includeReviews,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["experiment", experimentId] });
      setNotes("");
      setChk(false);
      toast("Pipeline re-queued.");
    },
  });

  const [section, setSection] = useState<ReviewCreateRequest["section"]>("protocol");
  const [rating, setRating] = useState(4);
  const [correction, setCorrection] = useState("");
  const [reviewer, setReviewer] = useState("");

  const submitReview = useMutation({
    mutationFn: (payload: ReviewCreateRequest) => api.createReview(experimentId, payload),
    onSuccess: () => {
      setCorrection("");
      void qc.invalidateQueries({ queryKey: ["reviews", experimentId] });
      toast("Review saved.");
    },
  });

  function onReviewSubmit(e: FormEvent) {
    e.preventDefault();
    submitReview.mutate({
      section,
      rating,
      correction: correction.trim() || null,
      reviewer: reviewer.trim() || null,
    });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ experiment, latest_plan }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `experiment-${experimentId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Summary exported.");
  }

  const noveltyTag = novelty ? noveltyLabelTag(novelty.label) : null;
  const totalDays =
    timeline?.critical_path_days ??
    (timeline?.phases ?? []).reduce((s, p) => s + p.duration_days, 0);

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-7">
      {/* Page header */}
      <div className="fu mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
            Step 4 of 4 · Summary
          </div>
          <h2 className="font-mono text-[22px] font-bold tracking-tight">Summary</h2>
          <p className="mt-1 text-xs text-fu-t3">
            Final runnable experiment package: literature signal, protocol, materials, budget,
            and timeline.
          </p>
        </div>
        {readinessPct != null && (
          <div className="text-right">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[.1em] text-fu-t4">
              Readiness
            </div>
            <div
              className="npop font-mono text-[36px] font-bold leading-none tracking-tight"
              style={{ color: readinessPct >= 80 ? "var(--fu-green)" : "var(--fu-amber)" }}
            >
              {readinessPct}%
            </div>
          </div>
        )}
      </div>

      {/* Decision + At a Glance 2-col */}
      {(syn || noveltyTag) && (
        <div className="mb-4 grid gap-3.5 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Experiment Decision */}
          <div className="fu-card border-[1.5px] border-black p-5">
            <div className="mb-2.5 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
              Experiment decision
            </div>
            {syn && (
              <>
                <div className="mb-2 font-mono text-[18px] font-bold leading-snug tracking-tight">
                  {syn.summary.split(". ")[0]}.
                </div>
                <p className="text-[12px] leading-relaxed text-fu-t2">{syn.summary}</p>
              </>
            )}
            {(syn?.cross_section_conflicts ?? []).length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-fu-amber">
                {syn!.cross_section_conflicts.map((c, i) => (
                  <li key={i}>⚠ {c}</li>
                ))}
              </ul>
            )}
          </div>

          {/* At a Glance */}
          <div className="fu-card p-5">
            <div className="mb-3 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
              At a glance
            </div>
            <div className="flex flex-col gap-2.5">
              {noveltyTag && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-fu-t3">Novelty signal</span>
                  <b className="text-[12px]">{noveltyTag.text}</b>
                </div>
              )}
              {materials?.budget_total != null && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-fu-t3">Budget</span>
                  <b className="font-mono text-[12px]">
                    {materials.currency} {materials.budget_total.toLocaleString()}
                  </b>
                </div>
              )}
              {totalDays > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-fu-t3">Timeline</span>
                  <b className="text-[12px]">{totalDays} days</b>
                </div>
              )}
              {validation?.primary_endpoint && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-fu-t3">Validation</span>
                  <b className="text-right text-[12px]" style={{ maxWidth: 160 }}>
                    {validation.primary_endpoint}
                  </b>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="fu-card mb-4 p-5">
        <div className="mb-3 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
          Checklist
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setChk(!chk)}
            className={`flex h-4 w-4 items-center justify-center rounded border-[1.5px] ${
              chk ? "border-black bg-black" : "border-[#ccc] bg-white"
            }`}
          >
            {chk && (
              <svg
                width="8"
                height="8"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          I confirm this package is ready for lab discussion
        </label>
      </div>

      {/* Regenerate */}
      <div className="fu-card mb-4 p-5">
        <h3 className="mb-2.5 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
          Regenerate with corrections
        </h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional instructions for the next pipeline run…"
          className="w-full rounded-md border border-fu-border p-2 text-xs"
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-fu-t3">
          <input
            type="checkbox"
            checked={includeReviews}
            onChange={(e) => setIncludeReviews(e.target.checked)}
          />
          Include saved review corrections in the prompt
        </label>
        <button
          type="button"
          disabled={regenerate.isPending || experiment.status === "RUNNING"}
          onClick={() => regenerate.mutate()}
          className="mt-3 rounded-md bg-black px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {regenerate.isPending ? "Queueing…" : "Regenerate with corrections"}
        </button>
      </div>

      {/* Expert review */}
      <div className="fu-card mb-6 p-5">
        <h3 className="mb-3 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
          Expert review
        </h3>
        <form onSubmit={onReviewSubmit} className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs">
            Section
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as ReviewCreateRequest["section"])}
              className="mt-1 w-full rounded border border-fu-border px-2 py-1 text-xs"
            >
              {(["novelty", "protocol", "materials", "timeline", "validation"] as const).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="text-xs">
            Rating
            <input
              type="number"
              min={1}
              max={5}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="mt-1 w-full rounded border border-fu-border px-2 py-1 text-xs"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            Correction
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-fu-border px-2 py-1 text-xs"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            Reviewer
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="mt-1 w-full rounded border border-fu-border px-2 py-1 text-xs"
            />
          </label>
          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={submitReview.isPending}
              className="rounded-md bg-black px-3 py-1.5 text-[10px] font-bold uppercase text-white"
            >
              Save review
            </button>
          </div>
        </form>
        <ul className="mt-4 divide-y divide-fu-border text-xs">
          {(reviews.data ?? []).map((r) => (
            <li key={r.id} className="py-2">
              <span className="font-medium">{r.section}</span> · {r.rating}/5
              {r.correction && <p className="text-fu-t3">{r.correction}</p>}
            </li>
          ))}
        </ul>
      </div>

      {/* Action bar */}
      <div className="fu-action-bar">
        <Link
          to={`/workspace/${experimentId}/planning`}
          className="flex items-center gap-1.5 rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-fu-t3"
        >
          Back to planning
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportJson}
            className="rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-fu-t3"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => {
              toast("Summary saved as the final runnable plan.");
            }}
            className="flex items-center gap-2 rounded-md bg-black px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white"
          >
            Save summary
          </button>
        </div>
      </div>
    </div>
  );
}
