import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/client";
import type { ReviewCreateRequest } from "../api/types";
import SectionCard from "./SectionCard";

const SECTIONS: ReviewCreateRequest["section"][] = [
  "novelty",
  "protocol",
  "materials",
  "timeline",
  "validation",
];

export default function ReviewPanel({ experimentId }: { experimentId: string }) {
  const qc = useQueryClient();
  const [section, setSection] = useState<ReviewCreateRequest["section"]>("protocol");
  const [rating, setRating] = useState(4);
  const [correction, setCorrection] = useState("");
  const [reviewer, setReviewer] = useState("");

  const reviews = useQuery({
    queryKey: ["reviews", experimentId],
    queryFn: () => api.listReviews(experimentId),
  });

  const submit = useMutation({
    mutationFn: (payload: ReviewCreateRequest) => api.createReview(experimentId, payload),
    onSuccess: () => {
      setCorrection("");
      qc.invalidateQueries({ queryKey: ["reviews", experimentId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate({
      section,
      rating,
      correction: correction.trim() || null,
      reviewer: reviewer.trim() || null,
    });
  }

  return (
    <SectionCard
      title="Expert review"
      subtitle="Rate sections and leave structured corrections to improve future plans."
    >
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-700">
          Section
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as ReviewCreateRequest["section"])}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-700">
          Rating (1-5)
          <input
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-slate-700 sm:col-span-2">
          Correction or annotation
          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="What is wrong? What should change?"
          />
        </label>
        <label className="text-xs text-slate-700 sm:col-span-2">
          Reviewer (optional)
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="Name or email"
          />
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={submit.isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submit.isPending ? "Saving..." : "Submit review"}
          </button>
        </div>
      </form>

      <div>
        <p className="text-xs font-semibold text-slate-700">Past reviews</p>
        <ul className="divide-y divide-slate-100 mt-1">
          {(reviews.data ?? []).map((r) => (
            <li key={r.id} className="py-2 text-sm">
              <p>
                <span className="font-medium">{r.section}</span> - rating {r.rating}/5
                {r.reviewer && <span className="text-xs text-slate-500"> by {r.reviewer}</span>}
              </p>
              {r.correction && <p className="text-xs text-slate-600 mt-0.5">{r.correction}</p>}
            </li>
          ))}
          {(reviews.data ?? []).length === 0 && (
            <li className="py-2 text-xs text-slate-500">No reviews yet.</li>
          )}
        </ul>
      </div>
    </SectionCard>
  );
}
