import type { RunStatus } from "../api/types";

const STYLES: Record<RunStatus, string> = {
  QUEUED: "bg-slate-100 text-slate-700",
  RUNNING: "bg-amber-100 text-amber-800",
  SUCCEEDED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-red-100 text-red-800",
};

export default function StatusPill({
  status,
  className = "",
}: {
  status: RunStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}
