from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import DATA_DIR, ROOT, prepare_data_dir


def make_engine(data_dir: Path = DATA_DIR):
    prepare_data_dir(data_dir)
    engine = create_engine(
        f"sqlite:///{data_dir / 'returnradar.sqlite3'}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")

    return engine


def migrate(engine) -> None:
    config = Config()
    config.set_main_option("script_location", str(ROOT / "backend" / "migrations"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


engine = make_engine()
SessionLocal = sessionmaker(engine, expire_on_commit=False)
