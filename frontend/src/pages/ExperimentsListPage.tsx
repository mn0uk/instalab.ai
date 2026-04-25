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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Experiments</h1>

      {isLoading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
        {(data ?? []).length === 0 && !isLoading && (
          <p className="p-6 text-sm text-slate-500">
            No experiments yet. Submit a hypothesis to get started.
          </p>
        )}
        {(data ?? []).map((e) => (
          <Link
            key={e.id}
            to={`/experiments/${e.id}`}
            className="block p-4 hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-900 truncate">{e.hypothesis}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(e.created_at).toLocaleString()}
                  {e.domain ? ` - ${e.domain}` : ""}
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
