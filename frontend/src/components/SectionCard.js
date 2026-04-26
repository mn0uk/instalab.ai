import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function SectionCard({ title, subtitle, children, }) {
    return (_jsxs("section", { className: "bg-white border border-slate-200 rounded-lg", children: [_jsxs("header", { className: "px-5 py-3 border-b border-slate-200", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-900", children: title }), subtitle && _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: subtitle })] }), _jsx("div", { className: "p-5 text-sm text-slate-800 space-y-3", children: children })] }));
}
