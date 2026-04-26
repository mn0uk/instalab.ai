import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { defaultWorkspacePath } from "../lib/workspaceSteps";

const EXAMPLES: Record<string, { text: string; domain: string; short: string; tagline: string }> = {
  cell: {
    text: "Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose's superior membrane stabilization at low temperatures.",
    domain: "Cell Biology",
    short:
      "Replacing sucrose with trehalose will increase post-thaw viability of HeLa cells by ≥15 pp vs DMSO.",
    tagline: "Can we keep more cells alive by swapping one preservative?",
  },
  diag: {
    text: "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing.",
    domain: "Diagnostics",
    short:
      "A paper-based electrochemical biosensor with anti-CRP antibodies will detect CRP below 0.5 mg/L in 10 min.",
    tagline: "A cheap, fast blood test for inflammation?",
  },
  gut: {
    text: "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.",
    domain: "Gut Health",
    short: "L. rhamnosus GG for 4 weeks will reduce intestinal permeability by ≥30% in C57BL/6 mice.",
    tagline: "Does a probiotic measurably strengthen the gut lining?",
  },
  climate: {
    text: "Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%.",
    domain: "Climate Science",
    short:
      "Sporomusa ovata at −400 mV vs SHE will fix CO₂ at ≥150 mmol/L/day, outperforming benchmarks by 20%.",
    tagline: "Can a microbe convert CO₂ into a useful chemical?",
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const [hypothesis, setHypothesis] = useState("");
  const [domain, setDomain] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: { hypothesis: string; domain?: string }) =>
      api.createExperiment(payload),
    onSuccess: (data) => {
      navigate(defaultWorkspacePath(data.id));
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (hypothesis.trim().length < 10) return;
    createMutation.mutate({
      hypothesis: hypothesis.trim(),
      domain: domain.trim() || undefined,
    });
  }

  function loadExample(key: string) {
    const ex = EXAMPLES[key];
    if (ex) {
      setHypothesis(ex.text);
      setDomain(ex.domain);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-fu-bg">
      <div className="mx-auto max-w-[800px] px-8 py-9">
        <div className="fu-animate mb-7">
          <div className="mb-3.5 flex items-center gap-2">
            <div className="flex gap-0.5">
              <div className="fu-pulse h-1.5 w-1.5 rounded-full bg-fu-red" />
              <div className="h-1.5 w-1.5 rounded-full bg-black opacity-20" />
              <div className="h-1.5 w-1.5 rounded-full bg-black opacity-10" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-fu-t3">
              7 AI Agents Ready
            </span>
          </div>
          <h1 className="font-mono text-4xl font-bold leading-tight tracking-tight">
            STATE YOUR
            <br />
            HYPOTHESIS.
          </h1>
          <p className="mt-2.5 max-w-md text-[13px] leading-relaxed text-fu-t3">
            Enter a scientific question. Agents will check the literature, preview a protocol,
            source materials, estimate cost, and build the experiment plan step by step.
          </p>
        </div>

        <form onSubmit={onSubmit} className="fu-animate fu-animate-delay-1 mb-6">
          <div className="fu-card border-[1.5px] border-black">
            <div className="fu-dot-grid border-b px-[18px] pb-3 pt-[18px]" style={{ borderColor: "var(--fu-border)" }}>
              <label className="mb-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-fu-t4">
                Hypothesis
              </label>
              <textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                rows={4}
                maxLength={600}
                className="w-full resize-none border-0 bg-transparent text-[13px] leading-relaxed text-fu-text placeholder:text-fu-t4 focus:outline-none focus:ring-0"
                placeholder="e.g. Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw viability…"
              />
            </div>
            <div className="flex items-center justify-between bg-[#FAFAF8] px-[18px] py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10px] text-fu-t4">
                  {hypothesis.length} / 600
                </span>
                <div className="h-3 w-px bg-fu-border" />
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="cursor-pointer border-0 bg-transparent text-[10px] font-bold uppercase tracking-wider text-fu-t3 focus:outline-none"
                >
                  <option value="">SELECT DOMAIN</option>
                  <option value="Cell Biology">CELL BIOLOGY</option>
                  <option value="Diagnostics">DIAGNOSTICS</option>
                  <option value="Gut Health">GUT HEALTH</option>
                  <option value="Climate Science">CLIMATE SCIENCE</option>
                  <option value="Neuroscience">NEUROSCIENCE</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHypothesis("")}
                  className="border-0 bg-transparent px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fu-t4"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || hypothesis.trim().length < 10}
                  className="flex items-center gap-1.5 rounded-md bg-black px-[18px] py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
                >
                  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {createMutation.isPending ? "Starting…" : "Generate plan"}
                </button>
              </div>
            </div>
          </div>
          {createMutation.isError && (
            <p className="mt-2 text-sm text-fu-red">
              {(createMutation.error as Error).message}
            </p>
          )}
        </form>

        <div className="fu-animate fu-animate-delay-2">
          <div className="mb-2.5 text-[9px] font-bold uppercase tracking-[0.14em] text-fu-t4">
            Example hypotheses
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["cell", "Cell Biology"],
                ["diag", "Diagnostics"],
                ["gut", "Gut Health"],
                ["climate", "Climate Science"],
              ] as const
            ).map(([key, cat]) => (
              <button
                key={key}
                type="button"
                onClick={() => loadExample(key)}
                className="fu-ex-card text-left"
              >
                <div className="mb-1.5 flex justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-fu-t4">
                    {cat}
                  </span>
                  <span className={`h-1.5 w-1.5 rounded-full ${key === "cell" ? "bg-fu-red" : "bg-black"}`} />
                </div>
                <p className="mb-1.5 text-[12px] leading-snug text-fu-t2">{EXAMPLES[key].short}</p>
                <p className="text-[10px] italic text-fu-t4">{EXAMPLES[key].tagline}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
