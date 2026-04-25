from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .agents.base import AgentContext
from .agents.orchestrator import Orchestrator
from .db import SessionLocal
from .models import AgentRun, Experiment, ExperimentPlan


logger = logging.getLogger(__name__)


def run_experiment_pipeline(experiment_id: str) -> None:
    """Run the full multi-agent pipeline for an experiment.

    Designed to be called from FastAPI BackgroundTasks. Uses its own DB session.
    """
    db: Session = SessionLocal()
    try:
        experiment = db.get(Experiment, experiment_id)
        if experiment is None:
            logger.error("Experiment %s not found; aborting pipeline", experiment_id)
            return

        experiment.status = "RUNNING"
        experiment.error = None
        db.commit()

        ctx = AgentContext(hypothesis=experiment.hypothesis, domain=experiment.domain)
        orchestrator = Orchestrator()

        agent_run_index: dict[str, AgentRun] = {}

        def on_agent_complete(name: str, status: str, output, error):
            run = agent_run_index.get(name)
            now = datetime.now(timezone.utc)
            if run is None:
                run = AgentRun(
                    experiment_id=experiment.id,
                    agent_name=name,
                    status=status,
                    started_at=now,
                )
                db.add(run)
                agent_run_index[name] = run
            run.status = status
            if status == "RUNNING":
                run.started_at = run.started_at or now
            else:
                run.finished_at = now
                run.output = output
                run.error = error
            db.commit()

        result = orchestrator.run(ctx, on_agent_complete=on_agent_complete)

        latest_version = (
            db.query(ExperimentPlan)
            .filter(ExperimentPlan.experiment_id == experiment.id)
            .count()
            + 1
        )
        plan = ExperimentPlan(
            experiment_id=experiment.id,
            version=latest_version,
            novelty=result.novelty or None,
            protocol=result.protocol or None,
            materials=result.materials or None,
            timeline=result.timeline or None,
            validation=result.validation or None,
            synthesis=result.synthesis or None,
        )
        db.add(plan)

        produced = [
            result.novelty,
            result.protocol,
            result.materials,
            result.timeline,
            result.validation,
            result.synthesis,
        ]
        any_success = any(p for p in produced)
        if not any_success:
            experiment.status = "FAILED"
            experiment.error = f"All agents failed: {result.agent_errors}"
        elif result.agent_errors:
            experiment.status = "SUCCEEDED"
            experiment.error = f"Partial failure: {result.agent_errors}"
        else:
            experiment.status = "SUCCEEDED"
            experiment.error = None
        db.commit()
    except Exception as exc:
        logger.exception("Pipeline failed for experiment %s", experiment_id)
        try:
            experiment = db.get(Experiment, experiment_id)
            if experiment is not None:
                experiment.status = "FAILED"
                experiment.error = str(exc)
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
