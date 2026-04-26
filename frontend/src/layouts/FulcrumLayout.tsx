import { Outlet } from "react-router-dom";

import { WorkspaceSidebar } from "../components/fulcrum/WorkspaceSidebar";
import { WorkspaceStepper } from "../components/fulcrum/WorkspaceStepper";
import { WorkspaceTopBar } from "../components/fulcrum/WorkspaceTopBar";
import { useGlobalToast } from "../lib/useToast";

export default function FulcrumLayout() {
  const { message } = useGlobalToast();
  return (
    <div className="flex h-full min-h-0 bg-fu-bg">
      <WorkspaceSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <WorkspaceTopBar />
        <WorkspaceStepper />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
      {message && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-md bg-black px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white shadow-xl">
          {message}
        </div>
      )}
    </div>
  );
}
