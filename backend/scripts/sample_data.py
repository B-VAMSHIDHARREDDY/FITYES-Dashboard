"""Create / refresh the SAMPLE dataset shown when the header's "Sample data" switch is on.

The demo data lives in its own Postgres schema (settings.sample_schema, default "realestate_sample"),
completely separate from the real data in settings.db_schema. Nothing here touches the real schema.

Usage (from backend/):
    python -m scripts.sample_data            # create schema + tables, (re)seed demo data
"""

from __future__ import annotations

from sqlalchemy import MetaData, func, select, text

from app.core.config import settings
from app.db.session import SampleSessionLocal, engine, sample_engine
from app.models import Activity, Agent, Base, Client, Deal, DealChecklistItem, MarketSnapshot, Property
from scripts.seed import reset, seed


def main() -> None:
    if not settings.sample_supported or sample_engine is None or SampleSessionLocal is None:
        raise SystemExit("Sample data needs PostgreSQL (it lives in a separate schema).")
    schema = settings.sample_schema

    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
    # Copy every table definition into the sample schema (FKs are re-targeted to it as well).
    sample_md = MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(sample_md, schema=schema)
    sample_md.create_all(engine)
    # Columns added by later migrations (create_all never alters existing tables).
    with engine.begin() as conn:
        for col, ddl in (("street", "VARCHAR(200)"), ("postal_code", "VARCHAR(10)"),
                         ("city", "VARCHAR(80)"), ("invoice_paid_at", "DATE")):
            conn.execute(text(f'ALTER TABLE "{schema}".clients ADD COLUMN IF NOT EXISTS {col} {ddl}'))

    with SampleSessionLocal() as db:
        reset(db)
        seed(db)
        counts = {m.__tablename__: db.scalar(select(func.count()).select_from(m))
                  for m in (Agent, Client, Property, Deal, DealChecklistItem, Activity, MarketSnapshot)}
    print(f'Sample data in schema "{schema}":', ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
