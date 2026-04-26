import { Outlet } from "react-router-dom";

import { WorkspaceSidebar } from "../components/fulcrum/WorkspaceSidebar";
import { WorkspaceTopBar } from "../components/fulcrum/WorkspaceTopBar";

export default function FulcrumLayout() {
  return (
    <div className="flex h-full min-h-0 bg-fu-bg">
      <WorkspaceSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <WorkspaceTopBar />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
