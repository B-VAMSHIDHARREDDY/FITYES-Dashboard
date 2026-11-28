"""(Re)generate the SAMPLE dataset file shown when the header's "Sample data" switch is on.

The demo data lives in `app/sample/sample_data.json`, never in the database. This script runs the
deterministic demo seed into a throw-away in-memory database and writes the result to that file.

Usage (from backend/):
    python -m scripts.sample_data
"""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.db.sample import SAMPLE_FILE, dump, new_memory_engine
from scripts.seed import seed


def main() -> None:
    engine = new_memory_engine()
    with Session(engine) as db:
        seed(db)
    data = dump(engine)
    SAMPLE_FILE.parent.mkdir(parents=True, exist_ok=True)
    SAMPLE_FILE.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = ", ".join(f"{name}={len(rows)}" for name, rows in data["tables"].items())
    print(f"Wrote {SAMPLE_FILE} ({SAMPLE_FILE.stat().st_size // 1024} KB): {counts}")


if __name__ == "__main__":
    main()
