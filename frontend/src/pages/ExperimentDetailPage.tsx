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
      if (!data) return 3000;
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

  if (!id) return null;
  if (detail.isLoading) return <p className="text-sm text-slate-500">Loading experiment...</p>;
  if (detail.error)
    return <p className="text-sm text-red-600">{(detail.error as Error).message}</p>;
  if (!detail.data) return null;

  const { experiment, agent_runs, latest_plan } = detail.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Experiment {experiment.id.slice(0, 8)}</p>
          <h1 className="text-xl font-semibold tracking-tight mt-1">{experiment.hypothesis}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {experiment.domain ? `${experiment.domain} - ` : ""}
            {new Date(experiment.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={experiment.status} />
          <button
            type="button"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending || experiment.status === "RUNNING"}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {regenerate.isPending ? "Re-running..." : "Re-run pipeline"}
          </button>
        </div>
      </div>

      {experiment.error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {experiment.error}
        </div>
      )}

      <AgentRunsCard runs={agent_runs} />

      {latest_plan?.synthesis && <SynthesisCard data={latest_plan.synthesis} />}
      {latest_plan?.novelty && <NoveltyCard data={latest_plan.novelty} />}
      {latest_plan?.protocol && <ProtocolCard data={latest_plan.protocol} />}
      {latest_plan?.materials && <MaterialsCard data={latest_plan.materials} />}
      {latest_plan?.timeline && <TimelineCard data={latest_plan.timeline} />}
      {latest_plan?.validation && <ValidationCard data={latest_plan.validation} />}

      <ReviewPanel experimentId={experiment.id} />
    </div>
  );
}
