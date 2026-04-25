import type { ValidationResult } from "../api/types";
import SectionCard from "./SectionCard";

export default function ValidationCard({ data }: { data: ValidationResult }) {
  return (
    <SectionCard
      title="Validation approach"
      subtitle="How success or failure will be measured."
    >
      <p>
        <span className="font-medium text-slate-700">Primary endpoint:</span>{" "}
        {data.primary_endpoint}
      </p>
      {data.secondary_endpoints.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Secondary endpoints</p>
          <ul className="list-disc pl-5 text-xs text-slate-700">
            {data.secondary_endpoints.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {data.acceptance_criteria.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Acceptance criteria</p>
          <ul className="list-disc pl-5 text-xs text-slate-700">
            {data.acceptance_criteria.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {data.qa_checks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">QA checks</p>
          <ul className="list-disc pl-5 text-xs text-slate-700">
            {data.qa_checks.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {data.standards_referenced.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Standards referenced</p>
          <ul className="list-disc pl-5 text-xs text-slate-700">
            {data.standards_referenced.map((e) => (
              <li key={e}>
                <a href={e} target="_blank" rel="noreferrer" className="underline">
                  {e}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
