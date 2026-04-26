import { Fragment } from "react";
import { useNavigate } from "react-router-dom";

import type { ExperimentDetailResponse } from "../../api/types";
import {
  STEP_LABELS,
  WORKSPACE_STEPS,
  type WorkspaceStep,
  isStepAccessible,
  isStepDone,
} from "../../lib/workspaceSteps";

function CheckIcon() {
  return (
    <svg
      width="9"
      height="9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function WorkspaceStepper({
  experimentId,
  currentStep,
  detail,
}: {
  experimentId: string;
  currentStep: WorkspaceStep;
  detail: ExperimentDetailResponse | undefined;
}) {
  const navigate = useNavigate();

  return (
    <div
      className="flex shrink-0 items-center border-b bg-white px-6"
      style={{ borderColor: "var(--fu-border)", padding: "9px 24px" }}
    >
      {WORKSPACE_STEPS.map((step, i) => {
        const n = i + 1;
        const done = isStepDone(step, detail);
        const active = step === currentStep;
        const accessible = isStepAccessible(step, detail);
        const prevDone = i > 0 && isStepDone(WORKSPACE_STEPS[i - 1], detail);

        return (
          <Fragment key={step}>
            {i > 0 && (
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: prevDone ? "#000" : "#ddd",
                  margin: "0 2px",
                  alignSelf: "center",
                  flexShrink: 0,
                  minWidth: 12,
                  maxWidth: 40,
                }}
              />
            )}
            <button
              type="button"
              disabled={!accessible}
              onClick={() => {
                if (accessible) navigate(`/workspace/${experimentId}/${step}`);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-1 py-1 text-left transition-opacity ${
                accessible ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-40"
              }`}
            >
              <div
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border-[1.5px] font-mono text-[9px] font-bold ${
                  active || done
                    ? "border-black bg-black text-white"
                    : "border-[#ddd] bg-transparent text-[#ccc]"
                }`}
              >
                {done && !active ? <CheckIcon /> : n}
              </div>
              <div
                className={`step-lbl min-w-0 truncate text-[10px] font-bold uppercase tracking-wider ${
                  active ? "text-black" : done ? "text-fu-t4" : "text-[#ccc]"
                }`}
              >
                {STEP_LABELS[step]}
              </div>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
