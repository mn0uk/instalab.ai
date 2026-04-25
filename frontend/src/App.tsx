import { Link, Route, Routes } from "react-router-dom";

import ExperimentDetailPage from "./pages/ExperimentDetailPage";
import ExperimentsListPage from "./pages/ExperimentsListPage";
import NewHypothesisPage from "./pages/NewHypothesisPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            AI Scientist
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/" className="text-slate-600 hover:text-slate-900">
              New hypothesis
            </Link>
            <Link to="/experiments" className="text-slate-600 hover:text-slate-900">
              Experiments
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<NewHypothesisPage />} />
            <Route path="/experiments" element={<ExperimentsListPage />} />
            <Route path="/experiments/:id" element={<ExperimentDetailPage />} />
          </Routes>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 text-xs text-slate-500">
          AI Scientist MVP - hypothesis to runnable experiment plan.
        </div>
      </footer>
    </div>
  );
}
