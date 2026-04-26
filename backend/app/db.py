from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .settings import get_settings


settings = get_settings()

connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (import to register tables)

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns() -> None:
    """Add columns introduced after first deploy (SQLite has no ALTER in metadata)."""
    if not settings.database_url.startswith("sqlite"):
        return
    insp = inspect(engine)
    if "experiments" not in insp.get_table_names():
        return
    col_names = {c["name"] for c in insp.get_columns("experiments")}
    with engine.begin() as conn:
        if "regenerate_context" not in col_names:
            conn.execute(text("ALTER TABLE experiments ADD COLUMN regenerate_context TEXT"))
