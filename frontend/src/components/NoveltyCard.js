import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SectionCard from "./SectionCard";
const LABEL_STYLES = {
    NOT_FOUND: "bg-emerald-100 text-emerald-800",
    SIMILAR_EXISTS: "bg-amber-100 text-amber-800",
    EXACT_MATCH: "bg-red-100 text-red-800",
};
export default function NoveltyCard({ data }) {
    return (_jsxs(SectionCard, { title: "Literature novelty check", subtitle: "Fast prior-art signal before planning.", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LABEL_STYLES[data.label]}`, children: data.label }), _jsxs("span", { className: "text-xs text-slate-500", children: ["confidence ", (data.confidence * 100).toFixed(0), "%"] })] }), data.rationale && _jsx("p", { className: "text-slate-700", children: data.rationale }), data.references.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-slate-700 mb-1", children: "References" }), _jsx("ul", { className: "space-y-2", children: data.references.map((ref) => (_jsxs("li", { className: "text-sm", children: [_jsx("a", { href: ref.url, target: "_blank", rel: "noreferrer", className: "text-slate-900 underline", children: ref.title }), ref.source && _jsxs("span", { className: "text-xs text-slate-500", children: [" - ", ref.source] }), ref.snippet && (_jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: ref.snippet }))] }, ref.url))) })] }))] }));
}
