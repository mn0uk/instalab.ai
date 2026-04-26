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

  return (
    <div className="h-full overflow-y-auto bg-fu-bg px-8 py-8">
      <h1 className="font-mono text-2xl font-bold tracking-tight">All experiments</h1>

      {isLoading && <p className="mt-4 text-sm text-fu-t3">Loading…</p>}
      {error && <p className="mt-4 text-sm text-fu-red">{(error as Error).message}</p>}

      <div className="fu-card mt-6 divide-y divide-fu-border">
        {(data ?? []).length === 0 && !isLoading && (
          <p className="p-6 text-sm text-fu-t3">
            No experiments yet. Submit a hypothesis from Workspace.
          </p>
        )}
        {(data ?? []).map((e) => (
          <Link
            key={e.id}
            to={`/workspace/${e.id}/literature`}
            className="block p-4 transition-colors hover:bg-[#F8F8F4]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm text-fu-text">{e.hypothesis}</p>
                <p className="mt-1 text-xs text-fu-t3">
                  {new Date(e.created_at).toLocaleString()}
                  {e.domain ? ` · ${e.domain}` : ""}
                </p>
              </div>
              <StatusPill status={e.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
