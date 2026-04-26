import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import StatusPill from "../components/StatusPill";
export default function ExperimentsListPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["experiments"],
        queryFn: api.listExperiments,
        refetchInterval: 4000,
    });
    return (_jsxs("div", { className: "h-full overflow-y-auto bg-fu-bg px-8 py-8", children: [_jsx("h1", { className: "font-mono text-2xl font-bold tracking-tight", children: "All experiments" }), isLoading && _jsx("p", { className: "mt-4 text-sm text-fu-t3", children: "Loading\u2026" }), error && _jsx("p", { className: "mt-4 text-sm text-fu-red", children: error.message }), _jsxs("div", { className: "fu-card mt-6 divide-y divide-fu-border", children: [(data ?? []).length === 0 && !isLoading && (_jsx("p", { className: "p-6 text-sm text-fu-t3", children: "No experiments yet. Submit a hypothesis from Workspace." })), (data ?? []).map((e) => (_jsx(Link, { to: `/workspace/${e.id}/literature`, className: "block p-4 transition-colors hover:bg-[#F8F8F4]", children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm text-fu-text", children: e.hypothesis }), _jsxs("p", { className: "mt-1 text-xs text-fu-t3", children: [new Date(e.created_at).toLocaleString(), e.domain ? ` · ${e.domain}` : ""] })] }), _jsx(StatusPill, { status: e.status })] }) }, e.id)))] })] }));
}
