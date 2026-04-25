import type { SynthesisResult } from "../api/types";
import SectionCard from "./SectionCard";

export default function SynthesisCard({ data }: { data: SynthesisResult }) {
  return (
    <SectionCard
      title="Plan synthesis"
      subtitle={`Overall confidence: ${(data.overall_confidence * 100).toFixed(0)}%`}
    >
      {data.summary && <p className="text-slate-800">{data.summary}</p>}
      {data.cross_section_conflicts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-700">Cross-section conflicts</p>
          <ul className="list-disc pl-5 text-xs text-amber-800">
            {data.cross_section_conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
