"""Load ONLY the partner list (Excel) into the database — no generated/sample data.

Excel columns (header row 1): Name | PLZ | Ort | Straße | E-mail | Datum Rechnung bezahlt

Each row becomes one Client: name, email, street, postal_code, city, invoice_paid_at.
`kind` is a required column with no Excel equivalent, so every partner is stored as "buyer";
pre_approved_amount stays empty. Agents, properties, deals and market data are left empty.

Usage (from backend/):
    python -m scripts.import_partners "FITYES_Partner_shareable with Developers.xlsx"          # refuses if data exists
    python -m scripts.import_partners "FITYES_Partner_shareable with Developers.xlsx" --reset  # wipes ALL app data first
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook
from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models import Activity, Agent, Client, Deal, DealChecklistItem, MarketSnapshot, Property
from app.models.enums import ClientKind
from scripts.seed import reset

COLS = {"name": "Name", "plz": "PLZ", "city": "Ort", "street": "Straße", "email": "E-mail",
        "paid": "Datum Rechnung bezahlt"}
# 4-digit postal codes are valid in Austria; everywhere else a 4-digit PLZ lost its leading zero.
AUSTRIAN_CITIES = {"wien", "graz", "linz", "salzburg", "innsbruck", "klagenfurt", "villach", "wels", "st. pölten"}
UNKNOWN_NAME = "Unbekannt"


@dataclass
class Partner:
    row: int
    name: str | None
    plz: str | None
    city: str | None
    street: str | None
    email: str | None
    paid: date | None


def _text(v: object) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _plz(v: object, city: str | None) -> str | None:
    if v is None or str(v).strip() == "":
        return None
    s = str(int(v)) if isinstance(v, float) and v.is_integer() else str(v).strip()
    if s.isdigit() and len(s) < 5 and (city or "").strip().lower() not in AUSTRIAN_CITIES:
        s = s.zfill(5)
    return s


def _date(v: object) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = _text(v)
    if not s:
        return None
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"unreadable date {s!r}")


def read_partners(path: Path) -> list[Partner]:
    ws = load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [_text(h) for h in next(rows)]
    missing = [h for h in COLS.values() if h not in header]
    if missing:
        raise SystemExit(f"Excel is missing column(s): {', '.join(missing)}. Found: {header}")
    idx = {k: header.index(h) for k, h in COLS.items()}
    out: list[Partner] = []
    for n, r in enumerate(rows, start=2):
        if not any(v not in (None, "") for v in r):
            continue
        r = tuple(r) + (None,) * (len(header) - len(r))  # read-only mode trims trailing empty cells
        city = _text(r[idx["city"]])
        out.append(Partner(row=n, name=_text(r[idx["name"]]), plz=_plz(r[idx["plz"]], city), city=city,
                           street=_text(r[idx["street"]]), email=_text(r[idx["email"]]),
                           paid=_date(r[idx["paid"]])))
    return out


def report(partners: list[Partner]) -> None:
    labels = {"name": "Name", "plz": "PLZ", "city": "Ort", "street": "Straße", "email": "E-mail",
              "paid": "Datum Rechnung bezahlt"}
    for field, label in labels.items():
        rows = [p.row for p in partners if getattr(p, field) is None]
        if rows:
            print(f"  missing {label:<24} {len(rows):>3} row(s): {rows}")


def load(partners: list[Partner]) -> None:
    with SessionLocal() as db:
        db.add_all(Client(name=p.name or UNKNOWN_NAME, email=p.email, kind=ClientKind.BUYER,
                          street=p.street, postal_code=p.plz, city=p.city, invoice_paid_at=p.paid)
                   for p in partners)
        db.commit()
        counts = {m.__tablename__: db.scalar(select(func.count()).select_from(m))
                  for m in (Client, Agent, Property, Deal, DealChecklistItem, Activity, MarketSnapshot)}
        print("Loaded:", ", ".join(f"{k}={v}" for k, v in counts.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("xlsx", type=Path, help="partner list (.xlsx)")
    parser.add_argument("--reset", action="store_true", help="delete ALL existing app data first")
    args = parser.parse_args()

    partners = read_partners(args.xlsx)
    print(f"Read {len(partners)} partner rows from {args.xlsx.name}")
    report(partners)

    with SessionLocal() as db:
        if args.reset:
            reset(db)
            print("Deleted all existing app data.")
        elif db.scalar(select(func.count(Client.id))):
            raise SystemExit("Data already present. Re-run with --reset to replace it.")
    load(partners)


if __name__ == "__main__":
    main()
