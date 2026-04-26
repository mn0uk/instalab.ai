import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import AgentRunsCard from "../components/AgentRunsCard";
import NoveltyCard from "../components/NoveltyCard";
import ProtocolCard from "../components/ProtocolCard";
import MaterialsCard from "../components/MaterialsCard";
import TimelineCard from "../components/TimelineCard";
import ValidationCard from "../components/ValidationCard";
import SynthesisCard from "../components/SynthesisCard";
import StatusPill from "../components/StatusPill";
import ReviewPanel from "../components/ReviewPanel";
export default function ExperimentDetailPage() {
    const { id = "" } = useParams();
    const qc = useQueryClient();
    const detail = useQuery({
        queryKey: ["experiment", id],
        queryFn: () => api.getExperiment(id),
        enabled: Boolean(id),
        refetchInterval: (q) => {
            const data = q.state.data;
            if (!data)
                return 3000;
            if (data.experiment.status === "QUEUED" || data.experiment.status === "RUNNING") {
                return 3000;
            }
            return false;
        },
    });
    const regenerate = useMutation({
        mutationFn: () => api.regenerate(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["experiment", id] }),
    });
    if (!id)
        return null;
    if (detail.isLoading)
        return _jsx("p", { className: "text-sm text-slate-500", children: "Loading experiment..." });
    if (detail.error)
        return _jsx("p", { className: "text-sm text-red-600", children: detail.error.message });
    if (!detail.data)
        return null;
    const { experiment, agent_runs, latest_plan } = detail.data;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "text-xs text-slate-500", children: ["Experiment ", experiment.id.slice(0, 8)] }), _jsx("h1", { className: "text-xl font-semibold tracking-tight mt-1", children: experiment.hypothesis }), _jsxs("p", { className: "text-xs text-slate-500 mt-1", children: [experiment.domain ? `${experiment.domain} - ` : "", new Date(experiment.created_at).toLocaleString()] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(StatusPill, { status: experiment.status }), _jsx("button", { type: "button", onClick: () => regenerate.mutate(), disabled: regenerate.isPending || experiment.status === "RUNNING", className: "rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50", children: regenerate.isPending ? "Re-running..." : "Re-run pipeline" })] })] }), experiment.error && (_jsx("div", { className: "rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800", children: experiment.error })), _jsx(AgentRunsCard, { runs: agent_runs }), latest_plan?.synthesis && _jsx(SynthesisCard, { data: latest_plan.synthesis }), latest_plan?.novelty && _jsx(NoveltyCard, { data: latest_plan.novelty }), latest_plan?.protocol && _jsx(ProtocolCard, { data: latest_plan.protocol }), latest_plan?.materials && _jsx(MaterialsCard, { data: latest_plan.materials }), latest_plan?.timeline && _jsx(TimelineCard, { data: latest_plan.timeline }), latest_plan?.validation && _jsx(ValidationCard, { data: latest_plan.validation }), _jsx(ReviewPanel, { experimentId: experiment.id })] }));
}
