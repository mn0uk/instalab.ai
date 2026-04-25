import type { TimelineResult } from "../api/types";
import SectionCard from "./SectionCard";

export default function TimelineCard({ data }: { data: TimelineResult }) {
  return (
    <SectionCard
      title="Timeline"
      subtitle={`Critical path: ${data.critical_path_days} days`}
    >
      <ol className="space-y-2">
        {data.phases.map((p) => (
          <li key={p.name} className="border border-slate-200 rounded-md p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{p.name}</p>
              <span className="text-xs text-slate-500">{p.duration_days} days</span>
            </div>
            {p.depends_on.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">Depends on: {p.depends_on.join(", ")}</p>
            )}
            {p.parallelizable && (
              <p className="text-xs text-emerald-700 mt-1">Parallelizable</p>
            )}
            {p.notes && <p className="text-xs text-slate-700 mt-1">{p.notes}</p>}
          </li>
        ))}
      </ol>
      {data.parallelization_notes && (
        <p className="text-xs text-slate-600">{data.parallelization_notes}</p>
      )}
    </SectionCard>
  );
}
