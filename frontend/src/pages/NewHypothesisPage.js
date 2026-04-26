import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
const SAMPLE_HYPOTHESES = [
    "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes.",
    "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls.",
    "Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol.",
];
export default function NewHypothesisPage() {
    const navigate = useNavigate();
    const [hypothesis, setHypothesis] = useState("");
    const [domain, setDomain] = useState("");
    const createMutation = useMutation({
        mutationFn: (payload) => api.createExperiment(payload),
        onSuccess: (data) => {
            navigate(`/experiments/${data.id}`);
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
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "From hypothesis to experiment plan" }), _jsx("p", { className: "text-slate-600 mt-1", children: "Submit a scientific hypothesis. The system runs a literature novelty check, then generates a protocol, materials list, timeline, and validation plan." })] }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-4 bg-white border border-slate-200 rounded-lg p-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "Hypothesis" }), _jsx("textarea", { value: hypothesis, onChange: (e) => setHypothesis(e.target.value), rows: 5, className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900", placeholder: "State an intervention, a measurable outcome with a threshold, and a control." })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "Domain (optional)" }), _jsx("input", { value: domain, onChange: (e) => setDomain(e.target.value), className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900", placeholder: "e.g. diagnostics, gut health, cell biology, climate" })] }), createMutation.isError && (_jsx("p", { className: "text-sm text-red-600", children: createMutation.error.message || "Failed to create experiment." })), _jsx("button", { type: "submit", disabled: createMutation.isPending || hypothesis.trim().length < 10, className: "inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50", children: createMutation.isPending ? "Submitting..." : "Generate experiment plan" })] }), _jsxs("div", { className: "bg-white border border-slate-200 rounded-lg p-6", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-700 mb-3", children: "Try a sample hypothesis" }), _jsx("ul", { className: "space-y-2", children: SAMPLE_HYPOTHESES.map((sample) => (_jsx("li", { children: _jsx("button", { type: "button", onClick: () => setHypothesis(sample), className: "text-left text-sm text-slate-600 hover:text-slate-900", children: sample }) }, sample))) })] })] }));
}
