import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SectionCard from "./SectionCard";
import StatusPill from "./StatusPill";
const AGENT_LABELS = {
    novelty: "1. Novelty Check",
    protocol: "2. Protocol",
    materials: "3. Materials and Supply Chain",
    timeline: "4. Timeline",
    validation: "5. Validation",
    synthesis: "6. Synthesis",
};
export default function AgentRunsCard({ runs }) {
    const ordered = [...runs].sort((a, b) => {
        const order = ["novelty", "protocol", "materials", "timeline", "validation", "synthesis"];
        return order.indexOf(a.agent_name) - order.indexOf(b.agent_name);
    });
    return (_jsx(SectionCard, { title: "Agent pipeline", subtitle: "Per-agent status and timing for transparency.", children: _jsxs("ul", { className: "divide-y divide-slate-100", children: [ordered.map((r) => (_jsxs("li", { className: "py-2 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-slate-900", children: AGENT_LABELS[r.agent_name] ?? r.agent_name }), r.error && _jsx("p", { className: "text-xs text-red-600 mt-0.5", children: r.error })] }), _jsx(StatusPill, { status: r.status })] }, r.agent_name))), ordered.length === 0 && (_jsx("li", { className: "py-2 text-xs text-slate-500", children: "Pipeline not started yet." }))] }) }));
}
