import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Route, Routes } from "react-router-dom";
import FulcrumLayout from "./layouts/FulcrumLayout";
import ExperimentsListPage from "./pages/ExperimentsListPage";
import HomePage from "./pages/HomePage";
import WorkspacePage from "./pages/WorkspacePage";
export default function App() {
    return (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(FulcrumLayout, {}), children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/experiments", element: _jsx(ExperimentsListPage, {}) }), _jsx(Route, { path: "/workspace/:experimentId", element: _jsx(WorkspacePage, {}) }), _jsx(Route, { path: "/workspace/:experimentId/:step", element: _jsx(WorkspacePage, {}) })] }) }));
}
