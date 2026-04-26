import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SectionCard from "./SectionCard";
export default function SynthesisCard({ data }) {
    return (_jsxs(SectionCard, { title: "Plan synthesis", subtitle: `Overall confidence: ${(data.overall_confidence * 100).toFixed(0)}%`, children: [data.summary && _jsx("p", { className: "text-slate-800", children: data.summary }), data.cross_section_conflicts.length > 0 && (_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-amber-700", children: "Cross-section conflicts" }), _jsx("ul", { className: "list-disc pl-5 text-xs text-amber-800", children: data.cross_section_conflicts.map((c) => (_jsx("li", { children: c }, c))) })] }))] }));
}
