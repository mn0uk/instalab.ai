import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "../../api/client";
import {
  STEP_LABELS,
  WORKSPACE_STEPS,
  type WorkspaceStep,
  isStepAccessible,
  isStepDone,
  parseWorkspaceStep,
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

function deriveCurrentStep(
  pathname: string,
  stepParam: string | undefined,
): WorkspaceStep {
  const parsed = parseWorkspaceStep(stepParam);
  if (parsed) return parsed;
  if (pathname === "/" || pathname === "") return "hypothesis";
  return "hypothesis";
}

export function WorkspaceStepper() {
  const navigate = useNavigate();
  const location = useLocation();
  const { experimentId, step: stepParam } = useParams();

  const detailQuery = useQuery({
    queryKey: ["experiment", experimentId],
    queryFn: () => api.getExperiment(experimentId as string),
    enabled: Boolean(experimentId),
  });
  const detail = detailQuery.data;

  const currentStep = deriveCurrentStep(location.pathname, stepParam);
  const hasExp = Boolean(experimentId);

  return (
    <div
      className="flex shrink-0 items-center border-b bg-white px-6"
      style={{ borderColor: "var(--fu-border)", padding: "9px 24px" }}
    >
      {WORKSPACE_STEPS.map((step, i) => {
        const n = i + 1;
        const done = hasExp ? isStepDone(step, detail) : false;
        const active = step === currentStep;
        const accessible = hasExp ? isStepAccessible(step, detail) : false;
        const prevDone =
          hasExp && i > 0 && isStepDone(WORKSPACE_STEPS[i - 1], detail);

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
              disabled={!hasExp || !accessible}
              onClick={() => {
                if (hasExp && accessible) {
                  navigate(`/workspace/${experimentId}/${step}`);
                }
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-1 py-1 text-left transition-opacity ${
                hasExp && accessible
                  ? "cursor-pointer hover:opacity-90"
                  : "cursor-not-allowed opacity-40"
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
