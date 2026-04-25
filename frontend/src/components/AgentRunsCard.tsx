import type { AgentRunSummary } from "../api/types";
import SectionCard from "./SectionCard";
import StatusPill from "./StatusPill";

const AGENT_LABELS: Record<string, string> = {
  novelty: "1. Novelty Check",
  protocol: "2. Protocol",
  materials: "3. Materials and Supply Chain",
  timeline: "4. Timeline",
  validation: "5. Validation",
  synthesis: "6. Synthesis",
};

export default function AgentRunsCard({ runs }: { runs: AgentRunSummary[] }) {
  const ordered = [...runs].sort((a, b) => {
    const order = ["novelty", "protocol", "materials", "timeline", "validation", "synthesis"];
    return order.indexOf(a.agent_name) - order.indexOf(b.agent_name);
  });

  return (
    <SectionCard title="Agent pipeline" subtitle="Per-agent status and timing for transparency.">
      <ul className="divide-y divide-slate-100">
        {ordered.map((r) => (
          <li key={r.agent_name} className="py-2 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-900">
                {AGENT_LABELS[r.agent_name] ?? r.agent_name}
              </p>
              {r.error && <p className="text-xs text-red-600 mt-0.5">{r.error}</p>}
            </div>
            <StatusPill status={r.status} />
          </li>
        ))}
        {ordered.length === 0 && (
          <li className="py-2 text-xs text-slate-500">Pipeline not started yet.</li>
        )}
      </ul>
    </SectionCard>
  );
}
