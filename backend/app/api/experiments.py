from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AgentRun, Experiment, ExperimentPlan, ReviewFeedback
from ..pipeline import run_experiment_pipeline
from ..schemas import (
    AgentRunSummary,
    ExperimentCreateRequest,
    ExperimentDetailResponse,
    ExperimentPlanResponse,
    ExperimentSummary,
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
    return [_to_summary(r) for r in rows]


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


@router.post("/{experiment_id}/regenerate", response_model=ExperimentSummary)
def regenerate_plan(
    experiment_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ExperimentSummary:
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
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


def _to_summary(e: Experiment) -> ExperimentSummary:
    return ExperimentSummary(
        id=e.id,
        hypothesis=e.hypothesis,
        domain=e.domain,
        status=e.status,  # type: ignore[arg-type]
        error=e.error,
        created_at=e.created_at,
        updated_at=e.updated_at,
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
