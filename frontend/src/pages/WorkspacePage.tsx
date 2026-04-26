import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import type {
  ExperimentDetailResponse,
  MaterialLineItem,
  MaterialsResult,
  ProtocolStep,
  ReviewCreateRequest,
  TimelinePhase,
} from "../api/types";
import StatusPill from "../components/StatusPill";
import {
  MATERIAL_CATEGORY_ORDER,
  materialCategoryDisplay,
  materialsByCategory,
  noveltyLabelTag,
  noveltyStatCounts,
  splitPapersByStance,
  synthesisConflicts,
  verificationNodes,
  type LiteraturePaperRow,
} from "../lib/planAdapters";
import { fireToast } from "../lib/useToast";
import {
  DEFAULT_PLANNING_TAB,
  isStepAccessible,
  parsePlanningTab,
  parseWorkspaceStep,
  PLANNING_TABS,
  type PlanningTab,
} from "../lib/workspaceSteps";

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

// ---------------------------------------------------------------------------
// Step-transition overlay (with Agent pipeline trace)
// ---------------------------------------------------------------------------

const AGENT_TRACE_LINES: { agent: string; log: string }[] = [
  { agent: "Claim Verifier", log: "Splitting hypothesis into tested claims and assumptions." },
  { agent: "Novelty", log: "Scanning literature for prior work and exact matches." },
  { agent: "Protocol", log: "Drafting executable steps with concrete parameters." },
  { agent: "Materials", log: "Resolving suppliers, catalog numbers, and pack sizes." },
  { agent: "Timeline", log: "Sequencing phases, lead-time risks, and milestones." },
  { agent: "Validation", log: "Anchoring endpoints and acceptance criteria." },
  { agent: "Synthesis", log: "Cross-checking sections for conflicts and readiness." },
];

function StepOverlay({ visible, msg }: { visible: boolean; msg: string }) {
  const [tickIdx, setTickIdx] = useState(0);
  useEffect(() => {
    if (!visible) {
      setTickIdx(0);
      return;
    }
    const id = setInterval(() => {
      setTickIdx((i) => Math.min(i + 1, AGENT_TRACE_LINES.length));
    }, 220);
    return () => clearInterval(id);
  }, [visible]);

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
      <div className="text-center">
        <p className="font-mono text-[12px] font-bold uppercase tracking-[.18em] text-fu-text">
          Agent pipeline
        </p>
        <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-widest text-fu-t3">
          {msg}
        </p>
      </div>
      <div
        id="agent-trace"
        className="mt-1 flex w-[420px] max-w-[80vw] flex-col gap-1.5 rounded-md border border-fu-border bg-white/80 p-3 backdrop-blur"
      >
        {AGENT_TRACE_LINES.map((line, i) => {
          const done = i < tickIdx;
          const active = i === tickIdx;
          return (
            <div
              key={line.agent}
              className="flex items-start gap-2"
              style={{ opacity: done ? 1 : active ? 1 : 0.4 }}
            >
              <div
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: done ? "var(--fu-green)" : active ? "#000" : "var(--fu-t4)",
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] font-bold uppercase tracking-[.1em] text-fu-text">
                  {line.agent}
                </div>
                <div className="text-[10px] text-fu-t3">{line.log}</div>
              </div>
              {active && (
                <span className="font-mono text-[9px] font-bold uppercase text-fu-t4">…</span>
              )}
              {done && (
                <span className="font-mono text-[9px] font-bold uppercase text-fu-green">
                  done
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspacePage
// ---------------------------------------------------------------------------

export default function WorkspacePage() {
  const {
    experimentId = "",
    step: stepParam,
    tab: tabParam,
  } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [overlayMsg, setOverlayMsg] = useState<string | null>(null);

  function toast(msg: string) {
    fireToast(msg);
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
  if (step === "planning" && !tabParam) {
    return (
      <Navigate
        to={`/workspace/${experimentId}/planning/${DEFAULT_PLANNING_TAB}`}
        replace
      />
    );
  }
  const planningTab: PlanningTab =
    step === "planning" ? parsePlanningTab(tabParam) ?? DEFAULT_PLANNING_TAB : DEFAULT_PLANNING_TAB;

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
            tab={planningTab}
          />
        )}
        {step === "summary" && (
          <SummaryStep experimentId={experimentId} data={data} qc={qc} toast={toast} />
        )}
      </div>
      <StepOverlay visible={Boolean(overlayMsg)} msg={overlayMsg ?? ""} />
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
  data: ExperimentDetailResponse;
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
            <option value="">SELECT DOMAIN</option>
            <option value="Cell Biology">CELL BIOLOGY</option>
            <option value="Diagnostics">DIAGNOSTICS</option>
            <option value="Gut Health">GUT HEALTH</option>
            <option value="Climate Science">CLIMATE SCIENCE</option>
            <option value="Neuroscience">NEUROSCIENCE</option>
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

function VerificationGraph({
  novelty,
}: {
  novelty: ExperimentDetailResponse["latest_plan"] extends infer P
    ? P extends { novelty?: infer N }
      ? N
      : never
    : never;
}) {
  const nodes = verificationNodes(novelty as Parameters<typeof verificationNodes>[0]);
  if (!nodes.length) return null;
  const colorOf = (state: string) =>
    state === "tested"
      ? "var(--fu-green)"
      : state === "assumed"
        ? "var(--fu-amber)"
        : "var(--fu-t4)";

  return (
    <div className="fu-card mb-3">
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--fu-border)" }}
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
          Hypothesis Verification Graph
        </span>
        <span className="font-mono text-[9px] tracking-wide text-fu-t4">
          <span style={{ color: "var(--fu-green)" }}>green</span> = tested ·{" "}
          <span style={{ color: "var(--fu-amber)" }}>indigo</span> = assumed ·{" "}
          <span style={{ color: "var(--fu-t4)" }}>grey</span> = out of scope
        </span>
      </div>
      <div className="p-4">
        <div
          className="grid items-stretch gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(nodes.length, 5)}, 1fr)` }}
        >
          {nodes.slice(0, 6).map((n, i) => (
            <div
              key={i}
              className="relative rounded-lg bg-white p-3"
              style={{ border: `1px solid ${colorOf(n.state)}`, minHeight: 96 }}
            >
              {i < Math.min(nodes.length, 6) - 1 && (
                <div
                  className="absolute"
                  style={{
                    right: -9,
                    top: 38,
                    width: 9,
                    height: 1,
                    background: "var(--fu-border)",
                  }}
                />
              )}
              <div
                className="mb-2 h-2 w-2 rounded-full"
                style={{ background: colorOf(n.state) }}
              />
              <div className="text-[11px] font-bold leading-snug text-fu-text">
                {n.label}
              </div>
              <p className="mt-1.5 text-[9px] leading-snug text-fu-t3">{n.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaperRow({ p, contradicting }: { p: LiteraturePaperRow; contradicting?: boolean }) {
  return (
    <div
      className="border-b py-2.5"
      style={{
        borderColor: "var(--fu-border)",
        background: contradicting ? "rgba(255,35,25,.035)" : "transparent",
      }}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold leading-snug text-fu-text">{p.title}</p>
          {(p.author || p.source || p.citations != null) && (
            <p className="mt-0.5 text-[10px] leading-snug text-fu-t3">
              {[p.author, p.source, p.citations != null ? `${p.citations} citations` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {(p.organism || p.source || p.url) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {p.organism && <span className="source-badge">{p.organism}</span>}
              {p.source && <span className="source-badge">via {p.source}</span>}
              {p.url && (
                <span className="source-badge">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    open source
                  </a>
                </span>
              )}
            </div>
          )}
          {p.summary && (
            <p className="mt-1.5 text-[10px] leading-snug text-fu-t2">{p.summary}</p>
          )}
        </div>
        <span
          className="shrink-0 font-mono text-xs font-bold"
          style={{ color: p.matchColor }}
        >
          {p.matchPct}%
        </span>
      </div>
    </div>
  );
}

function LiteratureStep({
  experimentId,
  data,
  qc,
  toast,
  navigateTo,
}: {
  experimentId: string;
  data: ExperimentDetailResponse;
  qc: ReturnType<typeof useQueryClient>;
  toast: (m: string) => void;
  navigateTo: (path: string, msg?: string) => void;
}) {
  const { experiment, latest_plan, agent_runs } = data;
  const novelty = latest_plan?.novelty;
  const split = useMemo(() => splitPapersByStance(novelty), [novelty]);
  const stats = useMemo(() => noveltyStatCounts(novelty), [novelty]);
  const tag = novelty
    ? noveltyLabelTag(novelty.label)
    : { text: "Running…", variant: "amber" as const };
  const scorePct = novelty ? Math.round((novelty.confidence ?? 0) * 100) : 0;

  const [hypothesis, setHypothesis] = useState(experiment.hypothesis);
  const [editing, setEditing] = useState(false);

  const patch = useMutation({
    mutationFn: () =>
      api.patchExperiment(experimentId, {
        hypothesis: hypothesis.trim(),
        domain: experiment.domain,
      }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["experiment", experimentId] });
      toast("Hypothesis saved.");
    },
  });

  const running = experiment.status === "RUNNING" || experiment.status === "QUEUED";
  const noveltyRun = agent_runs.find((r) => r.agent_name === "novelty");

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-7 pb-28">
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

      {running && noveltyRun?.status !== "SUCCEEDED" && (
        <div className="fu-card mb-4 p-6 text-center text-sm text-fu-t3">
          <div className="fu-spin mx-auto mb-2 h-6 w-6 rounded-full border-2 border-fu-border border-t-black" />
          Literature check in progress…
        </div>
      )}

      {novelty && (
        <div className="grid gap-3">
          <VerificationGraph novelty={novelty} />

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

          <div className="fu-card">
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "var(--fu-border)" }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                Evidence split
              </span>
              <button
                type="button"
                className="text-[9px] font-bold uppercase tracking-wider text-fu-t3 hover:text-black"
              >
                View all →
              </button>
            </div>
            <div className="grid gap-3.5 p-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[.1em]"
                    style={{ color: "var(--fu-green)" }}
                  >
                    Supporting mechanism
                  </span>
                  <span className="font-mono text-[10px] text-fu-t4">
                    {split.supporting.length}
                  </span>
                </div>
                {split.supporting.length === 0 && (
                  <p className="text-[10px] text-fu-t4">No supporting papers.</p>
                )}
                {split.supporting.map((p, i) => (
                  <PaperRow key={`s-${i}`} p={p} />
                ))}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[.1em]"
                    style={{ color: "var(--fu-red)" }}
                  >
                    Contradicting evidence
                  </span>
                  <span className="font-mono text-[10px] text-fu-t4">
                    {split.contradicting.length}
                  </span>
                </div>
                {split.contradicting.length === 0 && (
                  <p className="text-[10px] text-fu-t4">No contradicting papers.</p>
                )}
                {split.contradicting.map((p, i) => (
                  <PaperRow key={`c-${i}`} p={p} contradicting />
                ))}
              </div>
            </div>
            {split.neutral.length > 0 && (
              <div className="border-t px-4 py-3" style={{ borderColor: "var(--fu-border)" }}>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[.1em] text-fu-t4">
                  Neutral / unclassified
                </div>
                {split.neutral.map((p, i) => (
                  <PaperRow key={`n-${i}`} p={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                `/workspace/${experimentId}/planning/${DEFAULT_PLANNING_TAB}`,
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

type ChatMsg = { role: "user" | "ai"; text: string };

function aiReplyFor(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("replicate") || lower.includes("power") || lower.includes("n="))
    return "Increase biological replicates to n=6 per condition. That improves power for a 15 percentage point delta and adds about two bench days.";
  if (lower.includes("control"))
    return "Add untreated culture, a vehicle/standard control, and a handling control. Keep them in the same batch to avoid batch effects.";
  if (lower.includes("safety") || lower.includes("ln2") || lower.includes("hazard"))
    return "Add PPE notes, hazardous-material handling checks, and a post-procedure validation step before readout.";
  if (lower.includes("budget") || lower.includes("cheap") || lower.includes("cost"))
    return "Use existing core-facility resources and mark owned consumables as in-lab. The Budget tab will remove those costs from purchasing.";
  return "I would update the protocol by adding a short decision note, then preserve the current controls so the comparison remains interpretable.";
}

function PlanningStep({
  data,
  experimentId,
  qc,
  toast,
  tab,
}: {
  data: ExperimentDetailResponse;
  experimentId: string;
  qc: ReturnType<typeof useQueryClient>;
  toast: (m: string) => void;
  tab: PlanningTab;
}) {
  const navigate = useNavigate();
  const { latest_plan, experiment } = data;
  const protocol = latest_plan?.protocol;
  const materials = latest_plan?.materials;
  const timeline = latest_plan?.timeline;

  function setTab(next: PlanningTab) {
    navigate(`/workspace/${experimentId}/planning/${next}`);
  }

  const patchPlan = useMutation({
    mutationFn: (body: import("../api/types").PlanPatchRequest) =>
      api.patchLatestPlan(experimentId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["experiment", experimentId] }),
  });

  const running = experiment.status === "RUNNING" || experiment.status === "QUEUED";

  // Materials include/exclude state — initialise from `selected` flag if the
  // backend provided one, otherwise everything is included.
  const materialsItemsRef = materials?.line_items;
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const excludedSeededRef = useRef(false);
  useEffect(() => {
    if (excludedSeededRef.current) return;
    if (!materialsItemsRef) return;
    const initial = new Set<number>();
    materialsItemsRef.forEach((li, i) => {
      if (li.selected === false) initial.add(i);
    });
    setExcluded(initial);
    excludedSeededRef.current = true;
  }, [materialsItemsRef]);
  function toggleExclude(i: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  const items = materials?.line_items ?? [];
  const includedTotal = items
    .filter((_, i) => !excluded.has(i))
    .reduce((s, li) => s + (li.unit_price ?? 0) * (li.quantity ?? 1), 0);

  // Hero number = sum of selected items, falls back to backend total
  const budgetTotal = items.length > 0 ? includedTotal : materials?.budget_total;

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

  // Protocol AI chat
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  function sendChat() {
    const v = chatInput.trim();
    if (!v) return;
    setChatInput("");
    setChatHistory((prev) => [...prev, { role: "user", text: v }]);
    setTimeout(() => {
      setChatHistory((prev) => [...prev, { role: "ai", text: aiReplyFor(v) }]);
    }, 450);
  }
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Budget — Change supplier rotation
  function changeSupplier(idx: number) {
    const li = items[idx];
    if (!materials || !li || !li.options || li.options.length < 2) return;
    const currentLabel = `${li.supplier ?? ""} ${li.currency}${li.unit_price ?? 0}`.trim();
    const optList = li.options;
    const currentPos = Math.max(0, optList.indexOf(currentLabel));
    const nextLabel = optList[(currentPos + 1) % optList.length];
    const parsed = parseSupplierOption(nextLabel, li.currency);
    if (!parsed) return;
    const next: MaterialLineItem = {
      ...li,
      supplier: parsed.supplier,
      unit_price: parsed.price,
      currency: parsed.currency,
    };
    const nextItems = items.map((m, i) => (i === idx ? next : m));
    const nextMaterials: MaterialsResult = {
      ...materials,
      line_items: nextItems,
      budget_total: nextItems.reduce(
        (s, m) => s + (m.unit_price ?? 0) * (m.quantity ?? 1),
        0,
      ),
    };
    patchPlan.mutate({
      materials: nextMaterials as unknown as Record<string, unknown>,
    });
    toast(`Supplier → ${parsed.supplier}`);
  }

  // Timeline
  const phases = timeline?.phases ?? [];
  const totalDays =
    timeline?.critical_path_days ??
    phases.reduce((s, p) => s + p.duration_days, 0);
  const dayTicks = useMemo(() => buildDayTicks(totalDays), [totalDays]);
  const milestones = timeline?.milestones ?? [];
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState<number | null>(null);
  const selectedPhase =
    selectedPhaseIdx != null ? phases[selectedPhaseIdx] ?? null : null;

  return (
    <div className="mx-auto max-w-[1160px] px-8 py-7 pb-28">
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

      <div className="fu-card overflow-visible border-[1.5px] border-black">
        <div
          className="flex items-center gap-1 border-b bg-[#FAFAF8] px-3.5 py-2.5"
          style={{ borderColor: "var(--fu-border)" }}
        >
          {PLANNING_TABS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`fu-tab ${tab === id ? "active" : ""}`}
            >
              {id}
            </button>
          ))}
        </div>

        {tab === "protocol" && (
          <div className="flex min-h-0 flex-col" style={{ maxHeight: 620 }}>
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
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add step
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="flex flex-col gap-[7px]">
                {steps.map((s, i) => {
                  const protoUrl = (s.citations ?? []).find((c) => c.includes("protocols.io"));
                  return (
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
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-snug text-fu-t2">{s.action}</p>
                            {protoUrl && (
                              <div className="mt-1.5">
                                <span className="source-badge">
                                  <a href={protoUrl} target="_blank" rel="noreferrer">
                                    via protocols.io
                                  </a>
                                </span>
                              </div>
                            )}
                          </div>
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
                  );
                })}
                {steps.length === 0 && <p className="text-xs text-fu-t4">No protocol steps yet.</p>}
              </div>
            </div>

            <div
              className="shrink-0 border-t"
              style={{
                borderColor: "var(--fu-border)",
                background: "#FAFAF8",
                borderTopWidth: 1.5,
              }}
            >
              <div className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-black">
                  <svg width="10" height="10" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[.1em]">
                  AI Protocol Assistant
                </span>
                <span
                  className="ml-auto rounded border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider"
                  style={
                    chatHistory.length > 0
                      ? {
                          background: "rgba(0,179,65,.08)",
                          color: "var(--fu-green)",
                          borderColor: "rgba(0,179,65,.25)",
                        }
                      : {
                          color: "var(--fu-t4)",
                          borderColor: "var(--fu-border)",
                        }
                  }
                >
                  {chatHistory.length > 0 ? "Live response" : "Ready"}
                </span>
              </div>

              {chatHistory.length > 0 && (
                <div
                  ref={chatScrollRef}
                  className="mx-4 mb-2 flex max-h-[180px] flex-col gap-2 overflow-y-auto rounded-md bg-white p-2.5"
                  style={{ border: "1px solid var(--fu-border)" }}
                >
                  {chatHistory.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5"
                      style={{ flexDirection: m.role === "user" ? "row-reverse" : "row" }}
                    >
                      <div
                        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded"
                        style={{ background: m.role === "user" ? "#000" : "var(--fu-border)" }}
                      >
                        {m.role === "user" ? (
                          <svg width="9" height="9" fill="white" viewBox="0 0 24 24">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                          </svg>
                        ) : (
                          <svg width="9" height="9" fill="none" stroke="#555" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        )}
                      </div>
                      <div
                        className="rounded-md px-2.5 py-1.5 text-[11px] leading-snug"
                        style={{
                          maxWidth: "86%",
                          background: m.role === "user" ? "#000" : "#fff",
                          color: m.role === "user" ? "#fff" : "var(--fu-t2)",
                          border: "1px solid var(--fu-border)",
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 px-4 pb-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChat();
                  }}
                  placeholder="Refine steps, add controls, check safety, request replicates…"
                  className="flex-1 rounded-md border border-fu-border bg-white px-3 py-2 text-[11px] text-fu-text outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  disabled={!chatInput.trim()}
                  className="rounded-md bg-black px-4 py-2 text-[9px] font-bold uppercase tracking-[.1em] text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

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

            <MaterialsCategoryGrid
              materials={materials}
              excluded={excluded}
              toggleExclude={toggleExclude}
            />
          </div>
        )}

        {tab === "budget" && (
          <div className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
              <div>
                <div className="mb-2.5 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                  Purchasing plan
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((li, i) => {
                    const subline = [li.supplier, li.pack_size ?? li.quantity?.toString(), li.catalog_number]
                      .filter(Boolean)
                      .join(" · ");
                    const canChange = (li.options?.length ?? 0) >= 2;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col gap-1.5 rounded-md border border-fu-border px-3 py-2.5 transition-opacity ${excluded.has(i) ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-fu-t2">{li.name}</div>
                            {subline && <div className="text-[9px] text-fu-t4">{subline}</div>}
                          </div>
                          <span className="shrink-0 font-mono text-[11px] font-bold">
                            {li.unit_price != null
                              ? `${li.currency} ${(li.unit_price * (li.quantity ?? 1)).toLocaleString()}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {li.source_url && (
                            <span className="source-badge">
                              <a href={li.source_url} target="_blank" rel="noreferrer">
                                supplier URL
                              </a>
                            </span>
                          )}
                          {canChange && (
                            <button
                              type="button"
                              onClick={() => changeSupplier(i)}
                              disabled={patchPlan.isPending}
                              className="rounded border border-fu-border bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fu-t3 transition-colors hover:border-black hover:text-black disabled:opacity-40"
                            >
                              Change supplier
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="py-4 text-center text-xs text-fu-t4">No budget items yet.</p>
                  )}
                </div>
              </div>

              <div className="fu-card border-[1.5px] border-black p-4">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[.1em] text-fu-t4">
                  Budget model
                </div>
                <p className="mb-3 text-[12px] leading-snug text-fu-t2">
                  Only items marked as needed are counted. In-lab items are excluded from the
                  total.
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
                {(materials?.lead_time_risks ?? []).length > 0 ? (
                  <div className="mt-3 rounded-md border border-fu-border bg-[#FAFAF8] p-2.5">
                    <div className="mb-1 text-[10px] font-bold text-fu-text">Lead-time risks</div>
                    <ul className="space-y-0.5 text-[11px] text-fu-t3">
                      {materials!.lead_time_risks.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-fu-border bg-[#FAFAF8] p-2.5">
                    <div className="mb-1 text-[10px] font-bold text-fu-text">
                      Cheapest acceptable default
                    </div>
                    <p className="text-[11px] leading-snug text-fu-t3">
                      The budget starts with the lowest acceptable supplier, but preserves
                      alternates for reliability.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "timeline" && (
          <TimelineTab
            phases={phases}
            totalDays={totalDays}
            milestones={milestones}
            dayTicks={dayTicks}
            parallelizationNotes={timeline?.parallelization_notes ?? null}
            selectedPhaseIdx={selectedPhaseIdx}
            selectedPhase={selectedPhase}
            onSelectPhase={setSelectedPhaseIdx}
          />
        )}
      </div>

      <div className="fu-action-bar fixed bottom-0 left-[196px] right-0 z-30">
        <Link
          to={`/workspace/${experimentId}/literature`}
          className="rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-fu-t3"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={() => {
            window.print();
            toast("PDF / print dialog opened.");
          }}
          className="rounded-md bg-black px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white"
        >
          Export PDF / Print
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Materials category grid
// ---------------------------------------------------------------------------

function MaterialsCategoryGrid({
  materials,
  excluded,
  toggleExclude,
}: {
  materials: MaterialsResult | null | undefined;
  excluded: Set<number>;
  toggleExclude: (idx: number) => void;
}) {
  const grouped = useMemo(() => materialsByCategory(materials), [materials]);
  const items = materials?.line_items ?? [];

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-fu-t4">No materials yet.</p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {MATERIAL_CATEGORY_ORDER.map((cat) => {
        const rows = grouped[cat];
        if (rows.length === 0) return null;
        const display = materialCategoryDisplay(cat);
        return (
          <div key={cat} className="fu-card">
            <div
              className="border-b px-3.5 py-2.5"
              style={{ borderColor: "var(--fu-border)" }}
            >
              <div className="text-[9px] font-bold uppercase tracking-[.1em] text-fu-text">
                {display.label}
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-fu-t3">{display.note}</p>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {rows.map(({ item: li, index: i }) => {
                const isExcluded = excluded.has(i);
                return (
                  <label
                    key={i}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-opacity ${isExcluded ? "border-fu-border opacity-50" : "border-fu-border hover:border-[#aaa]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExclude(i)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] ${isExcluded ? "border-[#ccc] bg-white" : "border-black bg-black"}`}
                    >
                      {!isExcluded && (
                        <svg width="8" height="8" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium leading-snug text-fu-t2">{li.name}</div>
                      {li.supplier && (
                        <div className="text-[9px] text-fu-t4">{li.supplier}</div>
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
                      <div
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: isExcluded ? "var(--fu-t4)" : "var(--fu-green)" }}
                      >
                        {isExcluded ? "In lab" : "Need"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline tab + Gantt
// ---------------------------------------------------------------------------

function TimelineTab({
  phases,
  totalDays,
  milestones,
  dayTicks,
  parallelizationNotes,
  selectedPhaseIdx,
  selectedPhase,
  onSelectPhase,
}: {
  phases: TimelinePhase[];
  totalDays: number;
  milestones: { day: number; label: string }[];
  dayTicks: number[];
  parallelizationNotes: string | null;
  selectedPhaseIdx: number | null;
  selectedPhase: TimelinePhase | null;
  onSelectPhase: (idx: number | null) => void;
}) {
  const benchPhases = phases.filter((p) =>
    /(bench|expansion|setup|run|treat|imaging|sampling|freeze|thaw)/i.test(p.name),
  );
  const analysisPhases = phases.filter((p) =>
    /(analysis|report|review|decision|readout)/i.test(p.name),
  );
  const benchDays = benchPhases.reduce((s, p) => s + p.duration_days, 0);
  const analysisDays = analysisPhases.reduce((s, p) => s + p.duration_days, 0);

  const dateRange = useMemo(() => {
    if (totalDays <= 0) return null;
    const start = new Date();
    const end = new Date(start.getTime() + totalDays * 86400000);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [totalDays]);

  return (
    <div>
      <div
        className="flex flex-wrap items-center justify-between gap-2.5 border-b bg-[#FAFAF8] px-4 py-3"
        style={{ borderColor: "var(--fu-border)" }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[22px] font-bold leading-none">{totalDays}</span>
            <span className="text-[10px] font-semibold text-fu-t3">days</span>
          </div>
          {dateRange && (
            <>
              <div className="h-3.5 w-px bg-fu-border" />
              <span className="text-[10px] text-fu-t3">{dateRange}</span>
            </>
          )}
          <div className="h-3.5 w-px bg-fu-border" />
          <span className="text-[10px] text-fu-t3">{phases.length} phases</span>
          {benchDays > 0 && (
            <>
              <div className="h-3.5 w-px bg-fu-border" />
              <span className="text-[10px] text-fu-t3">
                {benchDays}d bench · {analysisDays}d analysis
              </span>
            </>
          )}
          {parallelizationNotes && (
            <>
              <div className="h-3.5 w-px bg-fu-border" />
              <span className="text-[10px] text-fu-t3">
                {parallelizationNotes.slice(0, 80)}
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

      <div className="overflow-x-auto p-4">
        <div style={{ minWidth: 640 }}>
          <div className="mb-1.5 flex items-center gap-0">
            <div className="w-[140px] shrink-0" />
            <div className="relative h-[18px] flex-1">
              {Array.from({ length: Math.max(1, Math.ceil(totalDays / 7)) }).map((_, w) => (
                <div
                  key={w}
                  className="absolute font-mono text-[8px] font-bold uppercase tracking-[.1em] text-fu-t4"
                  style={{ left: `${((w * 7) / Math.max(totalDays, 1)) * 100}%`, top: 2 }}
                >
                  W{w + 1}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-2 flex items-center gap-0">
            <div className="w-[140px] shrink-0" />
            <div className="relative h-[14px] flex-1">
              {dayTicks.map((d) => {
                const left = (d / Math.max(totalDays, 1)) * 100;
                const isAmber = d === 4;
                return (
                  <div
                    key={d}
                    className="absolute font-mono text-[8px] font-bold"
                    style={{
                      left: `${left}%`,
                      top: 0,
                      transform: "translateX(-50%)",
                      color: isAmber ? "var(--fu-amber)" : "var(--fu-t4)",
                    }}
                  >
                    D{d}
                  </div>
                );
              })}
            </div>
          </div>

          {phases.map((ph, i) => {
            const start = ph.start_day ?? 0;
            const dur = ph.duration_days;
            const leftPct = totalDays > 0 ? (start / totalDays) * 100 : 0;
            const widthPct = totalDays > 0 ? (dur / totalDays) * 100 : 0;
            const color = ph.depends_on.length > 0 ? "var(--fu-amber)" : "#000";
            const subLabel = ph.parallelizable ? "Parallel" : ph.depends_on[0] ?? "Primary";
            const active = selectedPhaseIdx === i;
            return (
              <div key={i} className="mb-1.5 flex items-center gap-0">
                <button
                  type="button"
                  onClick={() => onSelectPhase(active ? null : i)}
                  className="w-[140px] shrink-0 pr-2.5 text-left"
                >
                  <div className="text-[10px] font-bold leading-snug text-fu-text">{ph.name}</div>
                  <div className="text-[9px] text-fu-t4">{subLabel}</div>
                </button>
                <div className="relative h-[30px] flex-1">
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "repeating-linear-gradient(90deg,transparent,transparent calc(25% - 1px),#F0F0EC calc(25% - 1px),#F0F0EC 25%)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectPhase(active ? null : i)}
                    title={`${ph.name}: ${ph.duration_days} days`}
                    style={{
                      position: "absolute",
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      top: 7,
                      height: 16,
                      background: color,
                      borderRadius: 3,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 6px",
                      minWidth: 28,
                      border: active ? "1.5px solid #000" : "none",
                      boxShadow: active ? "0 0 0 2px rgba(0,0,0,.12)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      className="font-mono text-[8px] font-bold text-white"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {ph.duration_days}d
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
          {phases.length === 0 && (
            <p className="py-4 text-center text-xs text-fu-t4">No timeline yet.</p>
          )}

          {milestones.length > 0 && (
            <div className="mt-3 flex items-start gap-0">
              <div className="w-[140px] shrink-0 pr-2.5 text-left">
                <span className="text-[9px] font-bold uppercase tracking-[.1em] text-fu-t4">
                  Milestones
                </span>
              </div>
              <div className="relative h-[40px] flex-1">
                {milestones.map((m, i) => {
                  const left = (m.day / Math.max(totalDays, 1)) * 100;
                  return (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        transform: "translateX(-50%)",
                        top: 0,
                      }}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        style={{
                          width: 9,
                          height: 9,
                          background: "var(--fu-amber)",
                          transform: "rotate(45deg)",
                          borderRadius: 1,
                        }}
                      />
                      <span
                        className="font-mono text-[8px] font-bold uppercase tracking-wider text-fu-t3"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedPhase && selectedPhaseIdx != null && (
        <div className="mx-4 mb-4">
          <div
            className="rounded-lg bg-[#FAFAF8] p-3.5"
            style={{ border: "1.5px solid #000" }}
          >
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    background: selectedPhase.depends_on.length > 0 ? "var(--fu-amber)" : "#000",
                    transform: "rotate(45deg)",
                    borderRadius: 2,
                  }}
                />
                <span className="text-[12px] font-bold">{selectedPhase.name}</span>
                <span className="font-mono text-[10px] text-fu-t4">
                  {selectedPhase.start_day != null && selectedPhase.end_day != null
                    ? `Day ${selectedPhase.start_day}–${selectedPhase.end_day}`
                    : `${selectedPhase.duration_days}d`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(selectedPhase.owner || selectedPhase.status) && (
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[.06em] text-fu-t4">
                    {[selectedPhase.owner, selectedPhase.status].filter(Boolean).join(" · ")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onSelectPhase(null)}
                  className="border-0 bg-transparent text-[10px] text-fu-t4 hover:text-black"
                >
                  ✕
                </button>
              </div>
            </div>
            <p className="text-[12px] leading-snug text-fu-t2">
              {selectedPhase.detail ?? selectedPhase.notes ?? "No detail provided."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function buildDayTicks(totalDays: number): number[] {
  if (totalDays <= 0) return [0];
  const candidates = [0, 4, 7, 10, 14, 21, 28, 35, 42];
  const out = candidates.filter((d) => d <= totalDays);
  if (!out.includes(totalDays)) out.push(totalDays);
  return out;
}

function parseSupplierOption(
  label: string,
  fallbackCurrency: string,
): { supplier: string; price: number; currency: string } | null {
  const m = label.match(/^(.+?)\s+([A-Z]{3})\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (!m) return null;
  return {
    supplier: m[1].trim(),
    currency: m[2] || fallbackCurrency,
    price: Number(m[3]),
  };
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
  data: ExperimentDetailResponse;
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
  const conflicts = useMemo(() => synthesisConflicts(syn), [syn]);

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

  function exportPdfOrPrint() {
    window.print();
    toast("PDF / print dialog opened.");
  }

  const noveltyTag = novelty ? noveltyLabelTag(novelty.label) : null;
  const totalDays =
    timeline?.critical_path_days ??
    (timeline?.phases ?? []).reduce((s, p) => s + p.duration_days, 0);

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-7 pb-28">
      <div className="fu mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-fu-t4">
            Step 4 of 4 · Summary
          </div>
          <h2 className="font-mono text-[22px] font-bold tracking-tight">Summary</h2>
          <p className="mt-1 text-xs text-fu-t3">
            Final runnable experiment package: literature signal, protocol, materials, budget, and
            timeline.
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

      {(syn || noveltyTag) && (
        <div className="mb-4 grid gap-3.5 lg:grid-cols-[1.2fr_0.8fr]">
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
          </div>

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

      {conflicts.length > 0 && (
        <div
          className="fu-card mb-4"
          style={{ borderLeft: "3px solid var(--fu-amber)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3.5"
            style={{ borderColor: "var(--fu-border)" }}
          >
            <span className="text-[9px] font-bold uppercase tracking-[.12em] text-fu-t4">
              Synthesis Conflict List
            </span>
            <span className="font-mono text-[10px] font-bold" style={{ color: "var(--fu-amber)" }}>
              {conflicts.length} open
            </span>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${Math.min(conflicts.length, 3)}, 1fr)` }}
          >
            {conflicts.map((c, i) => (
              <div
                key={i}
                className="px-4 py-3.5"
                style={{
                  borderRight:
                    i < Math.min(conflicts.length, 3) - 1
                      ? "1px solid var(--fu-border)"
                      : "none",
                }}
              >
                <div className="text-[11px] font-bold leading-snug text-fu-text">{c.title}</div>
                {c.detail && (
                  <p className="mt-1 text-[10px] leading-snug text-fu-t3">{c.detail}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
              <svg width="8" height="8" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          I confirm this package is ready for lab discussion
        </label>
      </div>

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
              {(["novelty", "protocol", "materials", "timeline", "validation"] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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

      <div className="fu-action-bar fixed bottom-0 left-[196px] right-0 z-30">
        <Link
          to={`/workspace/${experimentId}/planning/${DEFAULT_PLANNING_TAB}`}
          className="flex items-center gap-1.5 rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-fu-t3"
        >
          Back to planning
        </Link>
        <button
          type="button"
          onClick={exportPdfOrPrint}
          className="rounded-md bg-black px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white"
        >
          Export PDF / Print
        </button>
      </div>
    </div>
  );
}
