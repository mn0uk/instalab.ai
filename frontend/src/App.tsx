import { Route, Routes } from "react-router-dom";

import FulcrumLayout from "./layouts/FulcrumLayout";
import ExperimentsListPage from "./pages/ExperimentsListPage";
import HomePage from "./pages/HomePage";
import WorkspacePage from "./pages/WorkspacePage";

export default function App() {
  return (
    <Routes>
      <Route element={<FulcrumLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/experiments" element={<ExperimentsListPage />} />
        <Route path="/workspace/:experimentId" element={<WorkspacePage />} />
        <Route path="/workspace/:experimentId/:step" element={<WorkspacePage />} />
        <Route
          path="/workspace/:experimentId/:step/:tab"
          element={<WorkspacePage />}
        />
      </Route>
    </Routes>
  );
}
