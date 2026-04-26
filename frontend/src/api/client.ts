import type {
  ExperimentDetailResponse,
  ExperimentPlanResponse,
  ExperimentSummary,
  ExperimentPatchRequest,
  PlanPatchRequest,
  RegenerateRequest,
  ReviewCreateRequest,
  ReviewResponse,
} from "./types";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => http<{ status: string }>("/health"),

  createExperiment: (payload: { hypothesis: string; domain?: string }) =>
    http<ExperimentSummary>("/experiments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listExperiments: () => http<ExperimentSummary[]>("/experiments"),

  getExperiment: (id: string) => http<ExperimentDetailResponse>(`/experiments/${id}`),

  patchExperiment: (id: string, payload: ExperimentPatchRequest) =>
    http<ExperimentSummary>(`/experiments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  patchLatestPlan: (id: string, payload: PlanPatchRequest) =>
    http<ExperimentPlanResponse>(`/experiments/${id}/latest-plan`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  regenerate: (id: string, payload?: RegenerateRequest) =>
    http<ExperimentSummary>(`/experiments/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }),

  createReview: (id: string, payload: ReviewCreateRequest) =>
    http<ReviewResponse>(`/experiments/${id}/reviews`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listReviews: (id: string) => http<ReviewResponse[]>(`/experiments/${id}/reviews`),
};
