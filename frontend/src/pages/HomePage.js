import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { defaultWorkspacePath } from "../lib/workspaceSteps";
const EXAMPLES = {
    cell: {
        text: "Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose's superior membrane stabilization at low temperatures.",
        domain: "Cell Biology",
    },
    diag: {
        text: "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing.",
        domain: "Diagnostics",
    },
    gut: {
        text: "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.",
        domain: "Gut Health",
    },
    climate: {
        text: "Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%.",
        domain: "Climate Science",
    },
};
export default function HomePage() {
    const navigate = useNavigate();
    const [hypothesis, setHypothesis] = useState("");
    const [domain, setDomain] = useState("");
    const createMutation = useMutation({
        mutationFn: (payload) => api.createExperiment(payload),
        onSuccess: (data) => {
            navigate(defaultWorkspacePath(data.id));
        },
    });
    function onSubmit(e) {
        e.preventDefault();
        if (hypothesis.trim().length < 10)
            return;
        createMutation.mutate({
            hypothesis: hypothesis.trim(),
            domain: domain.trim() || undefined,
        });
    }
    function loadExample(key) {
        const ex = EXAMPLES[key];
        if (ex) {
            setHypothesis(ex.text);
            setDomain(ex.domain);
        }
    }
    return (_jsx("div", { className: "h-full overflow-y-auto bg-fu-bg", children: _jsxs("div", { className: "mx-auto max-w-[800px] px-8 py-9", children: [_jsxs("div", { className: "fu-animate mb-7", children: [_jsxs("div", { className: "mb-3.5 flex items-center gap-2", children: [_jsxs("div", { className: "flex gap-0.5", children: [_jsx("div", { className: "fu-pulse h-1.5 w-1.5 rounded-full bg-fu-red" }), _jsx("div", { className: "h-1.5 w-1.5 rounded-full bg-black opacity-20" }), _jsx("div", { className: "h-1.5 w-1.5 rounded-full bg-black opacity-10" })] }), _jsx("span", { className: "text-[9px] font-bold uppercase tracking-[0.12em] text-fu-t3", children: "7 AI Agents Ready" })] }), _jsxs("h1", { className: "font-mono text-4xl font-bold leading-tight tracking-tight", children: ["STATE YOUR", _jsx("br", {}), "HYPOTHESIS."] }), _jsx("p", { className: "mt-2.5 max-w-md text-[13px] leading-relaxed text-fu-t3", children: "Enter a scientific question. Agents will check the literature, preview a protocol, source materials, estimate cost, and build the experiment plan step by step." })] }), _jsxs("form", { onSubmit: onSubmit, className: "fu-animate fu-animate-delay-1 mb-6", children: [_jsxs("div", { className: "fu-card border-[1.5px] border-black", children: [_jsxs("div", { className: "fu-dot-grid border-b px-[18px] pb-3 pt-[18px]", style: { borderColor: "var(--fu-border)" }, children: [_jsx("label", { className: "mb-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-fu-t4", children: "Hypothesis" }), _jsx("textarea", { value: hypothesis, onChange: (e) => setHypothesis(e.target.value), rows: 4, maxLength: 600, className: "w-full resize-none border-0 bg-transparent text-[13px] leading-relaxed text-fu-text placeholder:text-fu-t4 focus:outline-none focus:ring-0", placeholder: "e.g. Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw viability\u2026" })] }), _jsxs("div", { className: "flex items-center justify-between bg-[#FAFAF8] px-[18px] py-2.5", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [_jsxs("span", { className: "font-mono text-[10px] text-fu-t4", children: [hypothesis.length, " / 600"] }), _jsx("div", { className: "h-3 w-px bg-fu-border" }), _jsxs("select", { value: domain, onChange: (e) => setDomain(e.target.value), className: "cursor-pointer border-0 bg-transparent text-[10px] font-bold uppercase tracking-wider text-fu-t3 focus:outline-none", children: [_jsx("option", { value: "", children: "Select domain" }), _jsx("option", { value: "Cell Biology", children: "Cell Biology" }), _jsx("option", { value: "Diagnostics", children: "Diagnostics" }), _jsx("option", { value: "Gut Health", children: "Gut Health" }), _jsx("option", { value: "Climate Science", children: "Climate Science" }), _jsx("option", { value: "Neuroscience", children: "Neuroscience" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => setHypothesis(""), className: "border-0 bg-transparent px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fu-t4", children: "Clear" }), _jsxs("button", { type: "submit", disabled: createMutation.isPending || hypothesis.trim().length < 10, className: "flex items-center gap-1.5 rounded-md bg-black px-[18px] py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50", children: [_jsx("svg", { width: "10", height: "10", fill: "none", stroke: "currentColor", strokeWidth: "2.5", viewBox: "0 0 24 24", children: _jsx("polygon", { points: "5 3 19 12 5 21 5 3" }) }), createMutation.isPending ? "Starting…" : "Generate plan"] })] })] })] }), createMutation.isError && (_jsx("p", { className: "mt-2 text-sm text-fu-red", children: createMutation.error.message }))] }), _jsxs("div", { className: "fu-animate fu-animate-delay-2", children: [_jsx("div", { className: "mb-2.5 text-[9px] font-bold uppercase tracking-[0.14em] text-fu-t4", children: "Example hypotheses" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: [
                                ["cell", "Cell Biology", "Trehalose vs DMSO for HeLa viability"],
                                ["diag", "Diagnostics", "Paper biosensor for CRP"],
                                ["gut", "Gut Health", "LGG and permeability in mice"],
                                ["climate", "Climate Science", "S. ovata CO₂ to acetate"],
                            ].map(([key, cat, short]) => (_jsxs("button", { type: "button", onClick: () => loadExample(key), className: "fu-ex-card text-left", children: [_jsxs("div", { className: "mb-1.5 flex justify-between", children: [_jsx("span", { className: "text-[9px] font-bold uppercase tracking-wider text-fu-t4", children: cat }), _jsx("span", { className: `h-1.5 w-1.5 rounded-full ${key === "cell" ? "bg-fu-red" : "bg-black"}` })] }), _jsx("p", { className: "text-xs leading-snug text-fu-t2", children: short })] }, key))) })] })] }) }));
}
