import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { STEP_LABELS, WORKSPACE_STEPS, isStepAccessible, isStepDone, stepperIndexFor, } from "../../lib/workspaceSteps";
export function WorkspaceStepper({ experimentId, currentStep, detail, }) {
    const navigate = useNavigate();
    const currentIdx = stepperIndexFor(currentStep, detail);
    return (_jsxs("div", { className: "flex shrink-0 items-center gap-1.5 border-b bg-white px-6 py-2", style: { borderColor: "var(--fu-border)" }, children: [WORKSPACE_STEPS.map((step, i) => {
                const n = i + 1;
                const done = isStepDone(step, detail);
                const active = step === currentStep;
                const accessible = isStepAccessible(step, detail);
                return (_jsxs("button", { type: "button", disabled: !accessible, onClick: () => {
                        if (accessible)
                            navigate(`/workspace/${experimentId}/${step}`);
                    }, className: `flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-opacity ${accessible ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed opacity-40"}`, children: [_jsx("div", { className: `step-num flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border-[1.5px] font-mono text-[9px] font-bold ${active || done
                                ? "border-black bg-black text-white"
                                : "border-[#ddd] bg-transparent text-[#ccc]"}`, children: n }), _jsx("div", { className: `step-lbl min-w-0 truncate text-[10px] font-bold uppercase tracking-wider ${active ? "text-black" : done ? "text-fu-t4" : "text-[#ccc]"}`, children: STEP_LABELS[step] })] }, step));
            }), _jsxs("div", { className: "ml-2 font-mono text-[10px] text-fu-t4", children: ["Step ", currentIdx, " of ", WORKSPACE_STEPS.length] })] }));
}
