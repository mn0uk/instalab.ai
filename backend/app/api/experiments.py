from __future__ import annotations

import uuid
from typing import Any, List

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AgentRun, Experiment, ExperimentPlan, ReviewFeedback
from ..pipeline import run_experiment_pipeline
from ..schemas import (
    AgentRunSummary,
    ExperimentCreateRequest,
    ExperimentDetailResponse,
    ExperimentPatchRequest,
    ExperimentPlanResponse,
    ExperimentSummary,
    PlanPatchRequest,
    RegenerateRequest,
    ReviewCreateRequest,
    ReviewResponse,
)


router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post("", response_model=ExperimentSummary, status_code=201)
def create_experiment(
    payload: ExperimentCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ExperimentSummary:
    experiment = Experiment(
        id=str(uuid.uuid4()),
        hypothesis=payload.hypothesis.strip(),
        domain=payload.domain,
        status="QUEUED",
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    background_tasks.add_task(run_experiment_pipeline, experiment.id)
    return _to_summary(experiment)


@router.get("", response_model=List[ExperimentSummary])
def list_experiments(db: Session = Depends(get_db)) -> List[ExperimentSummary]:
    rows = (
        db.query(Experiment)
        .order_by(Experiment.created_at.desc())
        .limit(50)
        .all()
    )
    out: list[ExperimentSummary] = []
    for r in rows:
        latest_plan = (
            db.query(ExperimentPlan)
            .filter(ExperimentPlan.experiment_id == r.id)
            .order_by(ExperimentPlan.version.desc())
            .first()
        )
        score: int | None = None
        if latest_plan is not None and isinstance(latest_plan.novelty, dict):
            conf = latest_plan.novelty.get("confidence")
            if isinstance(conf, (int, float)):
                score = int(round(float(conf) * 100))
        out.append(_to_summary(r, novelty_score=score))
    return out


@router.get("/{experiment_id}", response_model=ExperimentDetailResponse)
def get_experiment(experiment_id: str, db: Session = Depends(get_db)) -> ExperimentDetailResponse:
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")

    runs = (
        db.query(AgentRun)
        .filter(AgentRun.experiment_id == experiment_id)
        .order_by(AgentRun.id.asc())
        .all()
    )
    latest_plan = (
        db.query(ExperimentPlan)
        .filter(ExperimentPlan.experiment_id == experiment_id)
        .order_by(ExperimentPlan.version.desc())
        .first()
    )

    return ExperimentDetailResponse(
        experiment=_to_summary(experiment),
        agent_runs=[_to_agent_summary(r) for r in runs],
        latest_plan=_to_plan_response(latest_plan) if latest_plan else None,
    )


def _deep_merge_plan_dict(base: dict[str, Any] | None, patch: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = dict(base or {})
    for key, val in patch.items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge_plan_dict(out[key], val)  # type: ignore[arg-type]
        else:
            out[key] = val
    return out


def _compose_regenerate_context(
    db: Session, experiment_id: str, payload: RegenerateRequest
) -> str | None:
    parts: list[str] = []
    if payload.notes and payload.notes.strip():
        parts.append(payload.notes.strip())
    if payload.include_review_corrections:
        rows = (
            db.query(ReviewFeedback)
            .filter(ReviewFeedback.experiment_id == experiment_id)
            .order_by(ReviewFeedback.created_at.desc())
            .limit(25)
            .all()
        )
        for r in rows:
            if r.correction and r.correction.strip():
                parts.append(f"[{r.section}] (rating {r.rating}/5): {r.correction.strip()}")
    return "\n\n".join(parts) if parts else None


@router.patch("/{experiment_id}", response_model=ExperimentSummary)
def patch_experiment(
    experiment_id: str,
    payload: ExperimentPatchRequest,
    db: Session = Depends(get_db),
) -> ExperimentSummary:
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    data = payload.model_dump(exclude_unset=True)
    if "hypothesis" in data and data["hypothesis"] is not None:
        experiment.hypothesis = data["hypothesis"].strip()
    if "domain" in data:
        experiment.domain = data["domain"]
    db.commit()
    db.refresh(experiment)
    return _to_summary(experiment)


@router.patch("/{experiment_id}/latest-plan", response_model=ExperimentPlanResponse)
def patch_latest_plan(
    experiment_id: str,
    payload: PlanPatchRequest,
    db: Session = Depends(get_db),
) -> ExperimentPlanResponse:
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    latest_plan = (
        db.query(ExperimentPlan)
        .filter(ExperimentPlan.experiment_id == experiment_id)
        .order_by(ExperimentPlan.version.desc())
        .first()
    )
    if latest_plan is None:
        raise HTTPException(status_code=404, detail="No experiment plan yet")
    patch = payload.model_dump(exclude_unset=True, exclude_none=True)
    for key in ("novelty", "protocol", "materials", "timeline", "validation", "synthesis"):
        if key not in patch:
            continue
        current = getattr(latest_plan, key)
        if not isinstance(patch[key], dict):
            setattr(latest_plan, key, patch[key])
        else:
            merged = _deep_merge_plan_dict(
                current if isinstance(current, dict) else None,
                patch[key],
            )
            setattr(latest_plan, key, merged)
    db.commit()
    db.refresh(latest_plan)
    return _to_plan_response(latest_plan)


@router.post("/{experiment_id}/regenerate", response_model=ExperimentSummary)
def regenerate_plan(
    experiment_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    payload: RegenerateRequest = Body(default_factory=RegenerateRequest),
) -> ExperimentSummary:
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    ctx_text = _compose_regenerate_context(db, experiment_id, payload)
    experiment.regenerate_context = ctx_text
    experiment.status = "QUEUED"
    experiment.error = None
    db.commit()
    background_tasks.add_task(run_experiment_pipeline, experiment.id)
    return _to_summary(experiment)


@router.post("/{experiment_id}/reviews", response_model=ReviewResponse, status_code=201)
def create_review(
    experiment_id: str,
    payload: ReviewCreateRequest,
    db: Session = Depends(get_db),
) -> ReviewResponse:
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    review = ReviewFeedback(
        experiment_id=experiment_id,
        section=payload.section,
        rating=payload.rating,
        correction=payload.correction,
        reviewer=payload.reviewer,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return ReviewResponse(
        id=review.id,
        experiment_id=review.experiment_id,
        section=review.section,
        rating=review.rating,
        correction=review.correction,
        reviewer=review.reviewer,
        created_at=review.created_at,
    )


@router.get("/{experiment_id}/reviews", response_model=List[ReviewResponse])
def list_reviews(experiment_id: str, db: Session = Depends(get_db)) -> List[ReviewResponse]:
    rows = (
        db.query(ReviewFeedback)
        .filter(ReviewFeedback.experiment_id == experiment_id)
        .order_by(ReviewFeedback.created_at.desc())
        .all()
    )
    return [
        ReviewResponse(
            id=r.id,
            experiment_id=r.experiment_id,
            section=r.section,
            rating=r.rating,
            correction=r.correction,
            reviewer=r.reviewer,
            created_at=r.created_at,
        )
        for r in rows
    ]


def _to_summary(e: Experiment, novelty_score: int | None = None) -> ExperimentSummary:
    return ExperimentSummary(
        id=e.id,
        hypothesis=e.hypothesis,
        domain=e.domain,
        status=e.status,  # type: ignore[arg-type]
        error=e.error,
        created_at=e.created_at,
        updated_at=e.updated_at,
        novelty_score=novelty_score,
    )


def _to_agent_summary(r: AgentRun) -> AgentRunSummary:
    return AgentRunSummary(
        agent_name=r.agent_name,
        status=r.status,  # type: ignore[arg-type]
        output=r.output,
        error=r.error,
        started_at=r.started_at,
        finished_at=r.finished_at,
    )


def _to_plan_response(p: ExperimentPlan) -> ExperimentPlanResponse:
    return ExperimentPlanResponse(
        id=p.id,
        experiment_id=p.experiment_id,
        version=p.version,
        novelty=p.novelty,  # type: ignore[arg-type]
        protocol=p.protocol,  # type: ignore[arg-type]
        materials=p.materials,  # type: ignore[arg-type]
        timeline=p.timeline,  # type: ignore[arg-type]
        validation=p.validation,  # type: ignore[arg-type]
        synthesis=p.synthesis,  # type: ignore[arg-type]
        created_at=p.created_at,
    )
