import { useQuery } from "@tanstack/react-query";
import { NavLink, useParams } from "react-router-dom";

import { api } from "../../api/client";
import type { RunStatus } from "../../api/types";

function NavIconHypothesis() {
  return (
    <svg width="13" height="13" fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
      <path
        d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        stroke="currentColor"
      />
    </svg>
  );
}

function NavIconSearch() {
  return (
    <svg width="13" height="13" fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" stroke="currentColor" />
      <path d="m21 21-4.35-4.35" stroke="currentColor" />
    </svg>
  );
}

function NavIconFlask() {
  return (
    <svg width="13" height="13" fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
      <path
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
        stroke="currentColor"
      />
    </svg>
  );
}

function NavIconCheckCircle() {
  return (
    <svg width="13" height="13" fill="none" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" />
    </svg>
  );
}

function statusDotColor(status: RunStatus): string {
  if (status === "RUNNING" || status === "QUEUED") return "var(--fu-amber)";
  if (status === "SUCCEEDED") return "#22c55e";
  return "#ef4444";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return "Today";
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function WorkspaceSidebar() {
  const { experimentId } = useParams();
  const { data: experiments } = useQuery({
    queryKey: ["experiments"],
    queryFn: api.listExperiments,
    refetchInterval: 5000,
  });

  const hasExp = Boolean(experimentId);

  return (
    <aside
      className="flex h-full w-[196px] min-w-[196px] shrink-0 flex-col border-r border-fu-border bg-white"
      style={{ borderColor: "var(--fu-border)" }}
    >
      {/* Branding */}
      <div
        className="flex items-center gap-2 border-b px-3.5 py-3"
        style={{ borderColor: "var(--fu-border)" }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-[1.5px] border-black bg-black">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2" width="4" height="4" fill="white" />
            <rect x="8" y="2" width="4" height="4" fill="white" opacity=".4" />
            <rect x="2" y="8" width="4" height="4" fill="white" opacity=".4" />
            <rect x="8" y="8" width="4" height="4" fill="white" />
          </svg>
        </div>
        <div>
          <div className="font-mono text-[10px] font-bold tracking-widest">FULCRUM</div>
          <div className="text-[9px] font-medium tracking-wider text-fu-t4">SCIENCE</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {/* PIPELINE section label */}
        <div className="mb-0.5 px-2 pt-1 font-mono text-[8px] font-bold uppercase tracking-[.12em] text-fu-t4">
          Pipeline
        </div>

        {/* Primary nav */}
        <NavLink
          to="/"
          end
          className={({ isActive }) => `fu-nav-item ${isActive ? "active" : ""}`}
        >
          <NavIconHypothesis />
          Hypothesis
        </NavLink>
        <NavLink
          to={hasExp ? `/workspace/${experimentId}/literature` : "/"}
          className={({ isActive }) =>
            `fu-nav-item ${isActive && hasExp ? "active" : ""} ${!hasExp ? "pointer-events-none opacity-40" : ""}`
          }
        >
          <NavIconSearch />
          Literature Review
        </NavLink>
        <NavLink
          to={hasExp ? `/workspace/${experimentId}/planning` : "/"}
          className={({ isActive }) =>
            `fu-nav-item ${isActive && hasExp ? "active" : ""} ${!hasExp ? "pointer-events-none opacity-40" : ""}`
          }
        >
          <NavIconFlask />
          Experiment Analysis
        </NavLink>
        <NavLink
          to={hasExp ? `/workspace/${experimentId}/summary` : "/"}
          className={({ isActive }) =>
            `fu-nav-item ${isActive && hasExp ? "active" : ""} ${!hasExp ? "pointer-events-none opacity-40" : ""}`
          }
        >
          <NavIconCheckCircle />
          Summary
        </NavLink>

        {/* History divider */}
        <div className="mx-1 my-1.5 h-px" style={{ background: "var(--fu-border)" }} />

        <div className="px-1 pt-0.5">
          <div className="mb-1.5 px-1 font-mono text-[9px] font-bold tracking-wider text-fu-t4">
            HISTORY
          </div>
          <div id="nav-history-list" className="flex max-h-52 flex-col overflow-y-auto">
            {(experiments ?? []).slice(0, 8).map((e, i) => {
              const shortId = `H-${String(i + 1).padStart(3, "0")}`;
              const date = formatDate(e.created_at);
              const dotColor = statusDotColor(e.status);

              return (
                <NavLink
                  key={e.id}
                  to={`/workspace/${e.id}/literature`}
                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[rgba(0,0,0,.04)] ${e.id === experimentId ? "bg-[rgba(0,0,0,.04)]" : ""}`}
                >
                  <div
                    className="mt-1 h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: dotColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-snug text-fu-t2"
                      title={e.hypothesis}
                    >
                      {e.hypothesis.slice(0, 72)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-[8px] text-fu-t4">{shortId}</span>
                      <span className="h-0.5 w-0.5 rounded-full bg-fu-t4" />
                      <span className="text-[8px] text-fu-t4">{date}</span>
                    </div>
                  </div>
                </NavLink>
              );
            })}
            {(experiments ?? []).length === 0 && (
              <p className="px-2 text-[10px] text-fu-t4">No experiments yet.</p>
            )}
          </div>
        </div>
      </nav>

      {/* User block */}
      <div className="border-t p-2" style={{ borderColor: "var(--fu-border)" }}>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="relative">
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-black font-mono text-[10px] font-bold text-white">
              AM
            </div>
            <div className="absolute -bottom-px -right-px h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-fu-green" />
          </div>
          <div>
            <div className="text-[11px] font-semibold leading-snug">Dr. Alex Morgan</div>
            <div className="text-[9px] text-fu-t4">Principal Scientist</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
