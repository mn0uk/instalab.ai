import type { ProtocolResult } from "../api/types";
import SectionCard from "./SectionCard";

export default function ProtocolCard({ data }: { data: ProtocolResult }) {
  return (
    <SectionCard
      title="Protocol"
      subtitle="Step-by-step methodology grounded in published protocols."
    >
      {data.control_design && (
        <p>
          <span className="font-medium text-slate-700">Control design:</span> {data.control_design}
        </p>
      )}
      {data.critical_parameters.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Critical parameters</p>
          <ul className="list-disc pl-5 text-sm text-slate-700">
            {data.critical_parameters.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="space-y-3">
        {data.steps.map((step) => (
          <li key={step.step_number} className="border-l-2 border-slate-200 pl-3">
            <p className="font-medium">
              Step {step.step_number}. {step.action}
            </p>
            {step.inputs.length > 0 && (
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Inputs:</span> {step.inputs.join(", ")}
              </p>
            )}
            {step.conditions && (
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Conditions:</span> {step.conditions}
              </p>
            )}
            {step.expected_output && (
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Expected:</span> {step.expected_output}
              </p>
            )}
            {step.safety_notes && (
              <p className="text-xs text-amber-700">
                <span className="font-semibold">Safety:</span> {step.safety_notes}
              </p>
            )}
            {step.citations.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Cites:{" "}
                {step.citations.map((c, i) => (
                  <span key={c}>
                    <a href={c} target="_blank" rel="noreferrer" className="underline">
                      [{i + 1}]
                    </a>{" "}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ol>

      {data.citations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700">Sources</p>
          <ul className="space-y-1">
            {data.citations.map((c) => (
              <li key={c.url} className="text-xs">
                <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                  {c.title}
                </a>
                {c.source && <span className="text-slate-500"> - {c.source}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
