import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { WorkspaceStepper } from "../components/fulcrum/WorkspaceStepper";
import StatusPill from "../components/StatusPill";
import { noveltyLabelTag, noveltyToPaperRows } from "../lib/planAdapters";
import { isStepAccessible, parseWorkspaceStep } from "../lib/workspaceSteps";
function SegBar({ scorePct }) {
    const total = 20;
    const on = Math.round((scorePct / 100) * total);
    return (_jsx("div", { className: "fu-seg-row mb-3", children: Array.from({ length: total }, (_, i) => (_jsx("div", { className: `fu-seg ${i < on ? "bg-black" : "bg-[#E0E0DC]"}` }, i))) }));
}
export default function WorkspacePage() {
    const { experimentId = "", step: stepParam } = useParams();
    const navigate = useNavigate();
    const qc = useQueryClient();
    if (!stepParam) {
        return _jsx(Navigate, { to: `/workspace/${experimentId}/literature`, replace: true });
    }
    const step = parseWorkspaceStep(stepParam);
    if (!step) {
        return _jsx(Navigate, { to: `/workspace/${experimentId}/literature`, replace: true });
    }
    const detail = useQuery({
        queryKey: ["experiment", experimentId],
        queryFn: () => api.getExperiment(experimentId),
        enabled: Boolean(experimentId),
        refetchInterval: (q) => {
            const d = q.state.data;
            if (!d)
                return 3000;
            if (d.experiment.status === "QUEUED" || d.experiment.status === "RUNNING")
                return 3000;
            return false;
        },
    });
    useEffect(() => {
        if (!detail.data)
            return;
        if (!isStepAccessible(step, detail.data)) {
            navigate(`/workspace/${experimentId}/literature`, { replace: true });
        }
    }, [detail.data, step, experimentId, navigate]);
    if (detail.isLoading) {
        return (_jsx("div", { className: "flex h-full items-center justify-center bg-fu-bg text-sm text-fu-t3", children: "Loading experiment\u2026" }));
    }
    if (detail.error || !detail.data) {
        return (_jsxs("div", { className: "p-8 text-sm text-fu-red", children: [detail.error?.message || "Not found", " ", _jsx(Link, { to: "/", className: "underline", children: "Home" })] }));
    }
    const data = detail.data;
    return (_jsxs("div", { className: "flex h-full min-h-0 flex-col bg-fu-bg", children: [_jsx(WorkspaceStepper, { experimentId: experimentId, currentStep: step, detail: data }), _jsxs("div", { className: "min-h-0 flex-1 overflow-y-auto", children: [step === "hypothesis" && (_jsx(HypothesisStep, { experimentId: experimentId, data: data })), step === "literature" && (_jsx(LiteratureStep, { experimentId: experimentId, data: data, qc: qc })), step === "planning" && _jsx(PlanningStep, { data: data, experimentId: experimentId, qc: qc }), step === "summary" && (_jsx(SummaryStep, { experimentId: experimentId, data: data, qc: qc }))] })] }));
}
function HypothesisStep({ experimentId, data, }) {
    const qc = useQueryClient();
    const { experiment } = data;
    const [hypothesis, setHypothesis] = useState(experiment.hypothesis);
    const [domain, setDomain] = useState(experiment.domain ?? "");
    const patch = useMutation({
        mutationFn: () => api.patchExperiment(experimentId, {
            hypothesis: hypothesis.trim(),
            domain: domain.trim() || null,
        }),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["experiment", experimentId] });
        },
    });
    return (_jsxs("div", { className: "mx-auto max-w-[800px] px-8 py-8", children: [_jsx("h2", { className: "font-mono text-xl font-bold", children: "Hypothesis" }), _jsx("p", { className: "mt-1 text-xs text-fu-t3", children: "Edit before re-running the pipeline from Summary." }), _jsxs("div", { className: "fu-card mt-4 border-[1.5px] border-black p-4", children: [_jsx("textarea", { value: hypothesis, onChange: (e) => setHypothesis(e.target.value), rows: 5, className: "w-full resize-none border-0 bg-transparent text-sm leading-relaxed focus:outline-none" }), _jsx("input", { value: domain, onChange: (e) => setDomain(e.target.value), placeholder: "Domain (optional)", className: "mt-3 w-full border border-fu-border bg-[#FAFAF8] px-2 py-1.5 text-xs" }), _jsx("button", { type: "button", disabled: patch.isPending || hypothesis.trim().length < 10, onClick: () => patch.mutate(), className: "mt-3 rounded-md bg-black px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50", children: patch.isPending ? "Saving…" : "Save changes" })] })] }));
}
function LiteratureStep({ experimentId, data, qc, }) {
    const { experiment, latest_plan, agent_runs } = data;
    const novelty = latest_plan?.novelty;
    const papers = useMemo(() => noveltyToPaperRows(novelty), [novelty]);
    const tag = novelty ? noveltyLabelTag(novelty.label) : { text: "Running…", variant: "amber" };
    const scorePct = novelty ? Math.round((novelty.confidence ?? 0) * 100) : 0;
    const [hypothesis, setHypothesis] = useState(experiment.hypothesis);
    const [editing, setEditing] = useState(false);
    const patch = useMutation({
        mutationFn: () => api.patchExperiment(experimentId, { hypothesis: hypothesis.trim(), domain: experiment.domain }),
        onSuccess: () => {
            setEditing(false);
            void qc.invalidateQueries({ queryKey: ["experiment", experimentId] });
        },
    });
    const running = experiment.status === "RUNNING" || experiment.status === "QUEUED";
    const noveltyRun = agent_runs.find((r) => r.agent_name === "novelty");
    return (_jsxs("div", { className: "mx-auto max-w-[1100px] px-8 py-7", children: [_jsxs("div", { className: "mb-5 flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "mb-1 text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Step 2 of 4 \u00B7 Literature review" }), _jsx("h2", { className: "font-mono text-[22px] font-bold tracking-tight", children: "Literature Review" }), _jsx("p", { className: "mt-1 text-xs text-fu-t3", children: "Prior work signal from the novelty agent. Refine your hypothesis if needed." })] }), _jsxs("div", { className: `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 ${tag.variant === "red"
                            ? "fu-tag-red"
                            : tag.variant === "green"
                                ? "fu-tag-green"
                                : "fu-tag-amber"}`, children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-current" }), _jsx("span", { className: "text-[9px] font-bold uppercase tracking-wide", children: tag.text })] })] }), _jsxs("div", { className: "fu-card mb-4 border-[1.5px] border-black", children: [_jsxs("div", { className: "flex items-center justify-between border-b bg-[#FAFAF8] px-4 py-3", style: { borderColor: "var(--fu-border)" }, children: [_jsx("span", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Your hypothesis" }), _jsx("button", { type: "button", onClick: () => (editing ? setEditing(false) : setEditing(true)), className: "rounded border-[1.5px] border-black bg-transparent px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider", children: editing ? "Close" : "Edit" })] }), _jsx("div", { className: "p-4", children: editing ? (_jsxs(_Fragment, { children: [_jsx("textarea", { value: hypothesis, onChange: (e) => setHypothesis(e.target.value), rows: 4, className: "w-full rounded-md border border-fu-border bg-[#F8F8F4] p-2.5 text-sm" }), _jsxs("div", { className: "mt-2 flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => {
                                                setHypothesis(experiment.hypothesis);
                                                setEditing(false);
                                            }, className: "rounded border border-fu-border px-3 py-1 text-[9px] font-bold uppercase", children: "Cancel" }), _jsx("button", { type: "button", disabled: patch.isPending || hypothesis.trim().length < 10, onClick: () => patch.mutate(), className: "rounded bg-black px-3 py-1 text-[9px] font-bold uppercase text-white disabled:opacity-50", children: "Save changes" })] })] })) : (_jsx("p", { className: "text-[13px] leading-relaxed", children: experiment.hypothesis })) })] }), running && noveltyRun?.status !== "SUCCEEDED" && (_jsxs("div", { className: "fu-card mb-4 p-6 text-center text-sm text-fu-t3", children: [_jsx("div", { className: "fu-spin mx-auto mb-2 h-6 w-6 rounded-full border-2 border-fu-border border-t-black" }), "Literature check in progress\u2026"] })), novelty && (_jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "fu-card", children: [_jsx("div", { className: "border-b px-4 py-3", style: { borderColor: "var(--fu-border)" }, children: _jsx("span", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Novelty score" }) }), _jsxs("div", { className: "p-4", children: [_jsxs("div", { className: "mb-2 flex items-end gap-1", children: [_jsx("span", { className: "font-mono text-[52px] font-bold leading-none", children: scorePct }), _jsx("span", { className: "mb-1 font-mono text-[22px] text-fu-t4", children: "%" })] }), _jsx(SegBar, { scorePct: scorePct }), _jsx("p", { className: "text-[11px] leading-snug text-fu-t3", children: novelty.rationale })] })] }), _jsxs("div", { className: "fu-card", children: [_jsx("div", { className: "border-b px-4 py-3", style: { borderColor: "var(--fu-border)" }, children: _jsx("span", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Matched references" }) }), _jsxs("div", { className: "flex flex-col gap-1 p-2", children: [papers.map((p, i) => (_jsxs("div", { className: "fu-paper-row", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx("p", { className: "flex-1 text-[11px] leading-snug text-fu-t2", children: p.title }), _jsxs("span", { className: "shrink-0 font-mono text-xs font-bold text-fu-red", children: [p.matchPct, "%"] })] }), p.subtitle && (_jsx("div", { className: "mt-0.5 text-[9px] text-fu-t4", children: p.subtitle })), p.url && (_jsx("a", { href: p.url, className: "mt-1 inline-block text-[9px] text-fu-t3 underline", children: "Open source" }))] }, i))), papers.length === 0 && (_jsx("p", { className: "p-2 text-xs text-fu-t4", children: "No references returned yet." }))] })] })] })), _jsxs("div", { className: "fu-action-bar mt-8", children: [_jsx(Link, { to: "/", className: "flex items-center gap-1.5 rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-fu-t3", children: "Back" }), _jsx(Link, { to: `/workspace/${experimentId}/planning`, className: "flex items-center gap-1.5 rounded-md bg-black px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white", children: "Continue to experiment planning" })] })] }));
}
function PlanningStep({ data, experimentId, qc, }) {
    const { latest_plan, experiment } = data;
    const [tab, setTab] = useState("protocol");
    const protocol = latest_plan?.protocol;
    const materials = latest_plan?.materials;
    const timeline = latest_plan?.timeline;
    const [stepText, setStepText] = useState("");
    const [selectedStep, setSelectedStep] = useState(0);
    const patchPlan = useMutation({
        mutationFn: (body) => api.patchLatestPlan(experimentId, body),
        onSuccess: () => void qc.invalidateQueries({ queryKey: ["experiment", experimentId] }),
    });
    const steps = protocol?.steps ?? [];
    const running = experiment.status === "RUNNING" || experiment.status === "QUEUED";
    function saveProtocolTweak() {
        if (!protocol || !stepText.trim())
            return;
        const nextSteps = steps.map((s, i) => i === selectedStep ? { ...s, action: stepText.trim() } : s);
        patchPlan.mutate({ protocol: { ...protocol, steps: nextSteps } });
        setStepText("");
    }
    return (_jsxs("div", { className: "mx-auto max-w-[1100px] px-8 py-7", children: [_jsxs("div", { className: "mb-5 flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "mb-1 text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Step 3 of 4 \u00B7 Experiment planning" }), _jsx("h2", { className: "font-mono text-[22px] font-bold tracking-tight", children: "Lab readiness" }), _jsx("p", { className: "mt-1 text-xs text-fu-t3", children: "Protocol, materials, budget, and timeline from the latest plan. Edits persist via API." })] }), _jsx(StatusPill, { status: experiment.status })] }), running && !protocol && (_jsx("div", { className: "fu-card mb-4 p-8 text-center text-sm text-fu-t3", children: "Agents still generating the plan\u2026" })), _jsx("div", { className: "mb-4 flex flex-wrap gap-1", children: [
                    ["protocol", "Protocol"],
                    ["materials", "Materials"],
                    ["budget", "Budget"],
                    ["timeline", "Timeline"],
                ].map(([id, label]) => (_jsx("button", { type: "button", onClick: () => setTab(id), className: `fu-tab ${tab === id ? "active" : ""}`, children: label }, id))) }), tab === "protocol" && (_jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsxs("div", { className: "fu-card p-4", children: [_jsx("h3", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Steps" }), _jsx("ul", { className: "mt-2 space-y-2", children: steps.map((s, i) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => {
                                            setSelectedStep(i);
                                            setStepText(s.action);
                                        }, className: `w-full rounded-lg border px-3 py-2 text-left text-xs ${selectedStep === i ? "border-black bg-[#F5F5F1]" : "border-fu-border"}`, children: [_jsxs("span", { className: "font-mono font-bold", children: [s.step_number, "."] }), " ", s.action] }) }, i))) }), steps.length === 0 && _jsx("p", { className: "text-xs text-fu-t4", children: "No protocol steps yet." })] }), _jsxs("div", { className: "fu-card p-4", children: [_jsx("h3", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Edit selected step" }), _jsx("textarea", { value: stepText, onChange: (e) => setStepText(e.target.value), rows: 6, className: "mt-2 w-full rounded-md border border-fu-border p-2 text-xs" }), _jsx("button", { type: "button", disabled: patchPlan.isPending || !protocol, onClick: saveProtocolTweak, className: "mt-2 rounded-md bg-black px-3 py-2 text-[10px] font-bold uppercase text-white disabled:opacity-50", children: "Save to plan" })] })] })), tab === "materials" && (_jsxs("div", { className: "fu-card overflow-x-auto", children: [_jsxs("table", { className: "w-full text-left text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-fu-border bg-[#FAFAF8]", children: [_jsx("th", { className: "p-2 font-bold uppercase tracking-wider text-fu-t4", children: "Item" }), _jsx("th", { className: "p-2", children: "Supplier" }), _jsx("th", { className: "p-2", children: "Cat #" }), _jsx("th", { className: "p-2 text-right", children: "Price" })] }) }), _jsx("tbody", { children: (materials?.line_items ?? []).map((li, i) => (_jsxs("tr", { className: "border-b border-fu-border/60", children: [_jsx("td", { className: "p-2", children: li.name }), _jsx("td", { className: "p-2 text-fu-t3", children: li.supplier ?? "—" }), _jsx("td", { className: "p-2 font-mono text-fu-t3", children: li.catalog_number ?? "—" }), _jsx("td", { className: "p-2 text-right", children: li.unit_price != null ? `${li.currency} ${li.unit_price}` : "—" })] }, i))) })] }), (materials?.line_items ?? []).length === 0 && (_jsx("p", { className: "p-4 text-xs text-fu-t4", children: "No materials yet." }))] })), tab === "budget" && (_jsxs("div", { className: "fu-card p-6", children: [_jsxs("p", { className: "font-mono text-3xl font-bold", children: [materials?.currency ?? "USD", " ", materials?.budget_total?.toLocaleString() ?? "—"] }), _jsx("p", { className: "mt-2 text-xs text-fu-t3", children: "Aggregated from line items where available." }), _jsx("ul", { className: "mt-4 space-y-1 text-xs text-fu-t3", children: (materials?.lead_time_risks ?? []).map((r, i) => (_jsxs("li", { children: ["\u2022 ", r] }, i))) })] })), tab === "timeline" && (_jsxs("div", { className: "space-y-2", children: [(timeline?.phases ?? []).map((ph, i) => (_jsxs("div", { className: "fu-card p-4", children: [_jsxs("div", { className: "flex justify-between gap-2", children: [_jsx("span", { className: "font-mono text-sm font-bold", children: ph.name }), _jsxs("span", { className: "text-xs text-fu-t4", children: [ph.duration_days, " days"] })] }), ph.notes && _jsx("p", { className: "mt-1 text-xs text-fu-t3", children: ph.notes })] }, i))), (timeline?.phases ?? []).length === 0 && (_jsx("p", { className: "text-xs text-fu-t4", children: "No timeline yet." }))] })), _jsxs("div", { className: "fu-action-bar mt-8", children: [_jsx(Link, { to: `/workspace/${experimentId}/literature`, className: "rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase", children: "Back" }), _jsx(Link, { to: `/workspace/${experimentId}/summary`, className: "rounded-md bg-black px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white", children: "Proceed to review" })] })] }));
}
function SummaryStep({ experimentId, data, qc, }) {
    const { experiment, latest_plan } = data;
    const syn = latest_plan?.synthesis;
    const [notes, setNotes] = useState("");
    const [includeReviews, setIncludeReviews] = useState(true);
    const [chk, setChk] = useState(false);
    const reviews = useQuery({
        queryKey: ["reviews", experimentId],
        queryFn: () => api.listReviews(experimentId),
    });
    const regenerate = useMutation({
        mutationFn: () => api.regenerate(experimentId, {
            notes: notes.trim() || null,
            include_review_corrections: includeReviews,
        }),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["experiment", experimentId] });
            setNotes("");
            setChk(false);
        },
    });
    const [section, setSection] = useState("protocol");
    const [rating, setRating] = useState(4);
    const [correction, setCorrection] = useState("");
    const [reviewer, setReviewer] = useState("");
    const submitReview = useMutation({
        mutationFn: (payload) => api.createReview(experimentId, payload),
        onSuccess: () => {
            setCorrection("");
            void qc.invalidateQueries({ queryKey: ["reviews", experimentId] });
        },
    });
    function onReviewSubmit(e) {
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
    }
    return (_jsxs("div", { className: "mx-auto max-w-[900px] px-8 py-7", children: [_jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "mb-1 text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Step 4 of 4 \u00B7 Summary" }), _jsx("h2", { className: "font-mono text-[22px] font-bold", children: "Review & export" }), _jsx("p", { className: "mt-1 text-xs text-fu-t3", children: "Synthesis overview, expert feedback, and full pipeline re-run with optional corrections." })] }), syn && (_jsxs("div", { className: "fu-card mb-6 p-5", children: [_jsx("div", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Synthesis" }), _jsx("p", { className: "mt-2 text-sm leading-relaxed", children: syn.summary }), _jsxs("p", { className: "mt-2 font-mono text-xs text-fu-t3", children: ["Confidence ", (syn.overall_confidence * 100).toFixed(0), "%"] }), (syn.cross_section_conflicts ?? []).length > 0 && (_jsx("ul", { className: "mt-2 list-inside list-disc text-xs text-fu-amber", children: syn.cross_section_conflicts.map((c, i) => (_jsx("li", { children: c }, i))) }))] })), _jsxs("div", { className: "fu-card mb-6 p-5", children: [_jsx("div", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4 mb-3", children: "Checklist" }), _jsxs("label", { className: "flex cursor-pointer items-center gap-2 text-xs", children: [_jsx("button", { type: "button", onClick: () => setChk(!chk), className: `flex h-4 w-4 items-center justify-center rounded border-[1.5px] ${chk ? "border-black bg-black" : "border-[#ccc] bg-white"}`, children: chk && _jsx("span", { className: "text-[10px] text-white", children: "\u2713" }) }), "I confirm this package is ready for lab discussion"] })] }), _jsxs("div", { className: "fu-card mb-6 p-5", children: [_jsx("h3", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Regenerate" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), rows: 3, placeholder: "Optional instructions for the next pipeline run\u2026", className: "mt-2 w-full rounded-md border border-fu-border p-2 text-xs" }), _jsxs("label", { className: "mt-2 flex items-center gap-2 text-xs text-fu-t3", children: [_jsx("input", { type: "checkbox", checked: includeReviews, onChange: (e) => setIncludeReviews(e.target.checked) }), "Include saved review corrections in the prompt"] }), _jsx("button", { type: "button", disabled: regenerate.isPending || experiment.status === "RUNNING", onClick: () => regenerate.mutate(), className: "mt-3 rounded-md bg-black px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50", children: regenerate.isPending ? "Queueing…" : "Regenerate with corrections" })] }), _jsxs("div", { className: "fu-card mb-6 p-5", children: [_jsx("h3", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: "Expert review" }), _jsxs("form", { onSubmit: onReviewSubmit, className: "mt-3 grid gap-2 sm:grid-cols-2", children: [_jsxs("label", { className: "text-xs", children: ["Section", _jsx("select", { value: section, onChange: (e) => setSection(e.target.value), className: "mt-1 w-full rounded border border-fu-border px-2 py-1 text-xs", children: ["novelty", "protocol", "materials", "timeline", "validation"].map((s) => (_jsx("option", { value: s, children: s }, s))) })] }), _jsxs("label", { className: "text-xs", children: ["Rating", _jsx("input", { type: "number", min: 1, max: 5, value: rating, onChange: (e) => setRating(Number(e.target.value)), className: "mt-1 w-full rounded border border-fu-border px-2 py-1 text-xs" })] }), _jsxs("label", { className: "text-xs sm:col-span-2", children: ["Correction", _jsx("textarea", { value: correction, onChange: (e) => setCorrection(e.target.value), rows: 2, className: "mt-1 w-full rounded border border-fu-border px-2 py-1 text-xs" })] }), _jsxs("label", { className: "text-xs sm:col-span-2", children: ["Reviewer", _jsx("input", { value: reviewer, onChange: (e) => setReviewer(e.target.value), className: "mt-1 w-full rounded border border-fu-border px-2 py-1 text-xs" })] }), _jsx("div", { className: "sm:col-span-2 flex justify-end", children: _jsx("button", { type: "submit", disabled: submitReview.isPending, className: "rounded-md bg-black px-3 py-1.5 text-[10px] font-bold uppercase text-white", children: "Save review" }) })] }), _jsx("ul", { className: "mt-4 divide-y divide-fu-border text-xs", children: (reviews.data ?? []).map((r) => (_jsxs("li", { className: "py-2", children: [_jsx("span", { className: "font-medium", children: r.section }), " \u00B7 ", r.rating, "/5", r.correction && _jsx("p", { className: "text-fu-t3", children: r.correction })] }, r.id))) })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx("button", { type: "button", onClick: exportJson, className: "rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase", children: "Export JSON" }), _jsx(Link, { to: `/workspace/${experimentId}/planning`, className: "rounded-md border border-fu-border bg-white px-4 py-2 text-[10px] font-bold uppercase", children: "Back to planning" })] })] }));
}
