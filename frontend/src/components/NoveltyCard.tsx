import type { NoveltyResult } from "../api/types";
import SectionCard from "./SectionCard";

const LABEL_STYLES: Record<NoveltyResult["label"], string> = {
  NOT_FOUND: "bg-emerald-100 text-emerald-800",
  SIMILAR_EXISTS: "bg-amber-100 text-amber-800",
  EXACT_MATCH: "bg-red-100 text-red-800",
};

export default function NoveltyCard({ data }: { data: NoveltyResult }) {
  return (
    <SectionCard title="Literature novelty check" subtitle="Fast prior-art signal before planning.">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LABEL_STYLES[data.label]}`}
        >
          {data.label}
        </span>
        <span className="text-xs text-slate-500">
          confidence {(data.confidence * 100).toFixed(0)}%
        </span>
      </div>

      {data.rationale && <p className="text-slate-700">{data.rationale}</p>}

      {data.references.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">References</p>
          <ul className="space-y-2">
            {data.references.map((ref) => (
              <li key={ref.url} className="text-sm">
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-900 underline"
                >
                  {ref.title}
                </a>
                {ref.source && <span className="text-xs text-slate-500"> - {ref.source}</span>}
                {ref.snippet && (
                  <p className="text-xs text-slate-500 mt-0.5">{ref.snippet}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
