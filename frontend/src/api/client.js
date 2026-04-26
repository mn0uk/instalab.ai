const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
async function http(path, init) {
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
    if (res.status === 204)
        return undefined;
    return (await res.json());
}
export const api = {
    health: () => http("/health"),
    createExperiment: (payload) => http("/experiments", {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    listExperiments: () => http("/experiments"),
    getExperiment: (id) => http(`/experiments/${id}`),
    patchExperiment: (id, payload) => http(`/experiments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    }),
    patchLatestPlan: (id, payload) => http(`/experiments/${id}/latest-plan`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    }),
    regenerate: (id, payload) => http(`/experiments/${id}/regenerate`, {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
    }),
    createReview: (id, payload) => http(`/experiments/${id}/reviews`, {
        method: "POST",
        body: JSON.stringify(payload),
    }),
    listReviews: (id) => http(`/experiments/${id}/reviews`),
};
