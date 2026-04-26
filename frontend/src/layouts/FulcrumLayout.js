import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from "react-router-dom";
import { WorkspaceSidebar } from "../components/fulcrum/WorkspaceSidebar";
import { WorkspaceTopBar } from "../components/fulcrum/WorkspaceTopBar";
export default function FulcrumLayout() {
    return (_jsxs("div", { className: "flex h-full min-h-0 bg-fu-bg", children: [_jsx(WorkspaceSidebar, {}), _jsxs("div", { className: "flex min-h-0 min-w-0 flex-1 flex-col", children: [_jsx(WorkspaceTopBar, {}), _jsx("div", { className: "min-h-0 flex-1 overflow-hidden", children: _jsx(Outlet, {}) })] })] }));
}
