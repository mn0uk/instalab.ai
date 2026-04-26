import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import SectionCard from "./SectionCard";
const SECTIONS = [
    "novelty",
    "protocol",
    "materials",
    "timeline",
    "validation",
];
export default function ReviewPanel({ experimentId }) {
    const qc = useQueryClient();
    const [section, setSection] = useState("protocol");
    const [rating, setRating] = useState(4);
    const [correction, setCorrection] = useState("");
    const [reviewer, setReviewer] = useState("");
    const reviews = useQuery({
        queryKey: ["reviews", experimentId],
        queryFn: () => api.listReviews(experimentId),
    });
    const submit = useMutation({
        mutationFn: (payload) => api.createReview(experimentId, payload),
        onSuccess: () => {
            setCorrection("");
            qc.invalidateQueries({ queryKey: ["reviews", experimentId] });
        },
    });
    function onSubmit(e) {
        e.preventDefault();
        submit.mutate({
            section,
            rating,
            correction: correction.trim() || null,
            reviewer: reviewer.trim() || null,
        });
    }
    return (_jsxs(SectionCard, { title: "Expert review", subtitle: "Rate sections and leave structured corrections to improve future plans.", children: [_jsxs("form", { onSubmit: onSubmit, className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("label", { className: "text-xs text-slate-700", children: ["Section", _jsx("select", { value: section, onChange: (e) => setSection(e.target.value), className: "mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm", children: SECTIONS.map((s) => (_jsx("option", { value: s, children: s }, s))) })] }), _jsxs("label", { className: "text-xs text-slate-700", children: ["Rating (1-5)", _jsx("input", { type: "number", min: 1, max: 5, value: rating, onChange: (e) => setRating(Number(e.target.value)), className: "mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm" })] }), _jsxs("label", { className: "text-xs text-slate-700 sm:col-span-2", children: ["Correction or annotation", _jsx("textarea", { value: correction, onChange: (e) => setCorrection(e.target.value), rows: 3, className: "mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm", placeholder: "What is wrong? What should change?" })] }), _jsxs("label", { className: "text-xs text-slate-700 sm:col-span-2", children: ["Reviewer (optional)", _jsx("input", { value: reviewer, onChange: (e) => setReviewer(e.target.value), className: "mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm", placeholder: "Name or email" })] }), _jsx("div", { className: "sm:col-span-2 flex justify-end", children: _jsx("button", { type: "submit", disabled: submit.isPending, className: "rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50", children: submit.isPending ? "Saving..." : "Submit review" }) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-slate-700", children: "Past reviews" }), _jsxs("ul", { className: "divide-y divide-slate-100 mt-1", children: [(reviews.data ?? []).map((r) => (_jsxs("li", { className: "py-2 text-sm", children: [_jsxs("p", { children: [_jsx("span", { className: "font-medium", children: r.section }), " - rating ", r.rating, "/5", r.reviewer && _jsxs("span", { className: "text-xs text-slate-500", children: [" by ", r.reviewer] })] }), r.correction && _jsx("p", { className: "text-xs text-slate-600 mt-0.5", children: r.correction })] }, r.id))), (reviews.data ?? []).length === 0 && (_jsx("li", { className: "py-2 text-xs text-slate-500", children: "No reviews yet." }))] })] })] }));
}
