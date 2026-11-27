"""Seed realistic German residential-market demo data (EUR, m²).

Usage (from backend/):
    python -m scripts.seed            # refuses if data already exists
    python -m scripts.seed --reset    # wipes ONLY this app's tables, then seeds
    python -m scripts.seed --add 100  # appends 100 more listings (+ deals) to existing data
"""

from __future__ import annotations

import argparse
import math
import random
import unicodedata
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import (
    Activity,
    Agent,
    Client,
    Deal,
    DealChecklistItem,
    DealStageEvent,
    MarketSnapshot,
    Property,
)
from app.models.enums import (
    DEAL_STAGE_ORDER,
    ActivityKind,
    ClientKind,
    DealStage,
    ListingStatus,
    PropertyType,
)
from app.services.deal_rules import STAGE_CHECKLIST, stage_label

rng = random.Random(42)
NOW = datetime.now(UTC)
TODAY = NOW.date()


@dataclass(frozen=True)
class Hood:
    city: str
    state: str  # Bundesland code
    name: str
    plz: str
    median: int  # EUR
    ppsqm: int  # EUR per m²
    lat: float
    lng: float
    area_code: str


HOODS = [
    Hood("Berlin", "BE", "Prenzlauer Berg", "10405", 640_000, 6_600, 52.5395, 13.4240, "30"),
    Hood("Berlin", "BE", "Charlottenburg", "10627", 690_000, 6_900, 52.5070, 13.3040, "30"),
    Hood("Berlin", "BE", "Kreuzberg", "10997", 560_000, 6_000, 52.4990, 13.4030, "30"),
    Hood("Berlin", "BE", "Zehlendorf", "14163", 1_050_000, 6_200, 52.4340, 13.2590, "30"),
    Hood("München", "BY", "Schwabing", "80801", 1_120_000, 10_600, 48.1620, 11.5860, "89"),
    Hood("München", "BY", "Maxvorstadt", "80333", 990_000, 10_900, 48.1500, 11.5700, "89"),
    Hood("München", "BY", "Bogenhausen", "81675", 1_350_000, 9_900, 48.1530, 11.6130, "89"),
    Hood("München", "BY", "Sendling", "81369", 780_000, 8_700, 48.1180, 11.5370, "89"),
    Hood("Hamburg", "HH", "Eppendorf", "20249", 840_000, 8_000, 53.5900, 9.9850, "40"),
    Hood("Hamburg", "HH", "Altona", "22765", 650_000, 6_600, 53.5510, 9.9350, "40"),
    Hood("Hamburg", "HH", "Blankenese", "22587", 1_600_000, 8_300, 53.5600, 9.8100, "40"),
    Hood("Hamburg", "HH", "Winterhude", "22299", 790_000, 7_700, 53.5940, 10.0050, "40"),
    Hood("Frankfurt am Main", "HE", "Westend", "60323", 1_060_000, 9_000, 50.1200, 8.6650, "69"),
    Hood("Frankfurt am Main", "HE", "Sachsenhausen", "60594", 700_000, 6_500, 50.1000, 8.6870, "69"),
    Hood("Frankfurt am Main", "HE", "Nordend", "60318", 730_000, 7_000, 50.1250, 8.6900, "69"),
    Hood("Frankfurt am Main", "HE", "Bornheim", "60385", 600_000, 5_900, 50.1300, 8.7100, "69"),
]

STREETS = ["Lindenstraße", "Schillerstraße", "Goethestraße", "Kastanienallee", "Bergstraße", "Parkstraße",
           "Rosenweg", "Ahornweg", "Uhlandstraße", "Mozartstraße", "Eichendorffstraße", "Hauptstraße",
           "Birkenweg", "Wiesenstraße", "Feldstraße", "Heinestraße", "Brahmsallee", "Gartenstraße",
           "Lessingstraße", "Am Stadtpark", "Kirchweg", "Bismarckstraße", "Holsteiner Chaussee", "Seestraße"]

STYLES = {
    PropertyType.SINGLE_FAMILY: ["Freistehendes Einfamilienhaus", "Stadtvilla", "Architektenhaus", "Landhaus",
                                 "Bungalow"],
    PropertyType.CONDO: ["Altbauwohnung", "Dachgeschosswohnung", "Penthouse", "Gartenwohnung", "Loft",
                         "Neubauwohnung"],
    PropertyType.TOWNHOUSE: ["Reihenmittelhaus", "Reiheneckhaus", "Doppelhaushälfte"],
    PropertyType.MULTI_FAMILY: ["Mehrfamilienhaus", "Zinshaus", "Wohn- und Geschäftshaus"],
    PropertyType.LAND: ["Baugrundstück", "Grundstück"],
}
FEATURES = {
    PropertyType.SINGLE_FAMILY: ["mit Garten", "mit Kamin", "mit Doppelgarage", "mit Wintergarten", "mit Sauna"],
    PropertyType.CONDO: ["mit Balkon", "mit Dachterrasse", "mit Stuck und Dielen", "mit Einbauküche",
                         "mit Tiefgaragenstellplatz", "mit Aufzug"],
    PropertyType.TOWNHOUSE: ["mit Garten", "mit Terrasse", "mit Carport", "mit ausgebautem Dachgeschoss"],
    PropertyType.MULTI_FAMILY: ["voll vermietet", "mit Entwicklungspotenzial", "in Top-Lage", "mit 6 Einheiten"],
    PropertyType.LAND: ["in ruhiger Lage", "mit Baugenehmigung", "in Bestlage", "für Doppelhaus"],
}
TYPE_DE = {
    PropertyType.SINGLE_FAMILY: "Einfamilienhaus", PropertyType.CONDO: "Eigentumswohnung",
    PropertyType.TOWNHOUSE: "Reihenhaus", PropertyType.MULTI_FAMILY: "Mehrfamilienhaus",
    PropertyType.LAND: "Grundstück",
}

FIRST = ["Lena", "Paul", "Mia", "Ben", "Emma", "Leon", "Hannah", "Finn", "Marie", "Elias", "Laura", "Noah",
         "Julia", "Lukas", "Sarah", "Tim", "Lisa", "Moritz", "Johanna", "David", "Katharina", "Niklas", "Greta",
         "Jonas", "Charlotte", "Felix"]
LAST = ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
        "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun",
        "Krüger", "Hartmann", "Lange", "Werner"]
AGENTS = [
    ("Lukas Hoffmann", "Geschäftsführender Makler", "Berlin", "#0f766e"),
    ("Anna Schneider", "Senior-Maklerin", "Berlin", "#7c3aed"),
    ("Felix Wagner", "Makler", "München", "#ea580c"),
    ("Sophie Becker", "Senior-Maklerin", "München", "#db2777"),
    ("Jonas Richter", "Makler", "Hamburg", "#2563eb"),
    ("Lea Fischer", "Teamleiterin", "Hamburg", "#16a34a"),
    ("Maximilian Weber", "Makler", "Frankfurt am Main", "#ca8a04"),
    ("Clara Neumann", "Junior-Maklerin", "Frankfurt am Main", "#0891b2"),
]
AREA_CODE = {"Berlin": "30", "München": "89", "Hamburg": "40", "Frankfurt am Main": "69"}
# Stored as keys; the UI translates them.
CHANNELS = ["immoscout24", "immowelt", "referral", "website", "open_house", "repeat_client"]
FINANCING = ["annuity_loan", "annuity_loan", "annuity_loan", "kfw_loan", "forward_loan", "cash"]


def ascii_slug(s: str) -> str:
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = s.replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace(" ", ".")


def phone(city: str) -> str:
    return f"+49 {AREA_CODE.get(city, '30')} {rng.randint(1000000, 9999999)}"


def money(x: float, step: int = 500) -> Decimal:
    return Decimal(int(round(x / step) * step))


def at(d: date, hour: int | None = None) -> datetime:
    """A business-hours timestamp on `d`, never later than now."""
    ts = datetime.combine(d, time(hour if hour is not None else rng.randint(8, 18), rng.randint(0, 59)), UTC)
    return min(ts, NOW - timedelta(minutes=rng.randint(5, 90)))


def month_back(back: int) -> date:
    y, m = divmod(TODAY.year * 12 + TODAY.month - 1 - back, 12)
    return date(y, m + 1, 1)


def seed_market(db: Session) -> None:
    for hood in HOODS:
        growth = rng.uniform(-0.003, 0.005)
        inv_base = rng.randint(30, 95)
        for back in range(23, -1, -1):
            month = month_back(back)
            t = 23 - back
            season = math.sin(2 * math.pi * (month.month - 3) / 12)
            price = hood.median / (1 + growth) ** 23 * (1 + growth) ** t * (1 + 0.02 * season) * rng.uniform(0.985, 1.015)
            inventory = max(int(inv_base * (1 + 0.22 * season) * rng.uniform(0.9, 1.1)), 5)
            db.add(MarketSnapshot(
                city=hood.city, neighborhood=hood.name, month=month, median_price=money(price, 1000),
                price_per_sqm=Decimal(f"{hood.ppsqm * price / hood.median * rng.uniform(0.98, 1.02):.2f}"),
                inventory=inventory, new_listings=int(inventory * rng.uniform(0.35, 0.55)),
                closed_sales=max(int(inventory * rng.uniform(0.22, 0.42) * (1 + 0.2 * season)), 2),
                avg_days_on_market=int(max(18, 48 - 14 * season + rng.uniform(-6, 6))),
            ))


def make_property(idx: int, hood: Hood, agent: Agent) -> Property:
    ptype = rng.choices(list(STYLES), weights=[22, 52, 14, 8, 4])[0]
    if ptype == PropertyType.LAND:
        beds, baths, area, plot = 0, 0.0, rng.randint(450, 1200), None
    elif ptype == PropertyType.CONDO:
        beds, area, plot = rng.randint(1, 3), rng.randint(42, 145), None
        baths = 1.0 if area < 90 else 2.0
    elif ptype == PropertyType.MULTI_FAMILY:
        beds, area, plot = rng.randint(8, 18), rng.randint(320, 780), rng.randint(400, 1200)
        baths = float(max(4, beds // 2))
    elif ptype == PropertyType.TOWNHOUSE:
        beds, area, plot = rng.randint(3, 4), rng.randint(105, 170), rng.randint(180, 400)
        baths = 2.0
    else:
        beds, area, plot = rng.randint(3, 6), rng.randint(120, 280), rng.randint(450, 1400)
        baths = float(rng.choice([2, 2, 3]))
    if ptype == PropertyType.LAND:
        plot = area
    ppsqm = hood.ppsqm * (0.22 if ptype == PropertyType.LAND else 0.82 if ptype == PropertyType.MULTI_FAMILY else 1)
    list_price = money(area * ppsqm * rng.uniform(0.85, 1.18), 5000)
    year = None if ptype == PropertyType.LAND else rng.choice(
        [rng.randint(1890, 1914), rng.randint(1950, 1979), rng.randint(1990, 2025)])
    listed_at = TODAY - timedelta(days=int(rng.triangular(0, 420, 40)))
    rooms = beds + 1 if ptype not in (PropertyType.LAND, PropertyType.MULTI_FAMILY) else beds
    if ptype == PropertyType.LAND:
        desc = (f"{TYPE_DE[ptype]} in {hood.name} ({hood.city}) mit {plot:,} m² Fläche. "
                "Erschlossen, voll bebaubar nach Bebauungsplan.").replace(",", ".")
    else:
        desc = (f"{rooms}-Zimmer-{TYPE_DE[ptype]} in {hood.name} ({hood.city}), ca. {area} m² Wohnfläche"
                f"{f', Baujahr {year}' if year else ''}. Gute Anbindung an den ÖPNV, Einkaufsmöglichkeiten "
                "und Grünflächen in direkter Nähe.")
    return Property(
        code=f"OBJ-{listed_at:%y%m}-{idx:04d}",
        title=f"{rng.choice(STYLES[ptype])} {rng.choice(FEATURES[ptype])}",
        address=f"{rng.choice(STREETS)} {rng.randint(1, 140)}", city=hood.city, neighborhood=hood.name,
        state=hood.state, zip_code=hood.plz, property_type=ptype, status=ListingStatus.ACTIVE,
        list_price=list_price, bedrooms=beds, bathrooms=Decimal(str(baths)), area_sqm=area, plot_sqm=plot,
        year_built=year,
        # Hausgeld (monthly service charge) applies to apartments; Grundsteuer is low in Germany.
        hoa_monthly=money(area * rng.uniform(3.2, 4.8), 5) if ptype == PropertyType.CONDO else Decimal(0),
        tax_annual=money(float(list_price) * rng.uniform(0.0012, 0.0028), 10),
        listed_at=listed_at,
        latitude=hood.lat + rng.uniform(-0.008, 0.008), longitude=hood.lng + rng.uniform(-0.008, 0.008),
        description=desc, agent=agent,
    )


def build_deal(db: Session, code: str, prop: Property, client: Client, agent: Agent, stage: DealStage,
               entered: date, *, open_items: int | None = None) -> Deal:
    list_price = float(prop.list_price)
    deal = Deal(
        code=code, property=prop, client=client, agent=agent, stage=stage,
        stage_entered_at=at(entered), channel=rng.choice(CHANNELS), financing=rng.choice(FINANCING),
        offer_price=money(list_price * rng.uniform(0.93, 1.02)),
        down_payment_pct=Decimal(rng.choice([10, 15, 20, 20, 25, 30])),
        interest_rate=Decimal(f"{rng.uniform(3.2, 4.4):.3f}"),
        loan_term_years=rng.choice([20, 25, 30, 30]),
        commission_rate=Decimal(rng.choice(["0.0238", "0.0300", "0.0357", "0.0357"])),
        offer_version=rng.randint(1, 7),
    )
    path = list(DEAL_STAGE_ORDER[: DEAL_STAGE_ORDER.index(stage) + 1]) if stage != DealStage.LOST else \
        list(DEAL_STAGE_ORDER[: rng.randint(1, 3)]) + [DealStage.LOST]
    cursor = entered
    dates: list[date] = []
    for _ in path:
        dates.append(cursor)
        cursor -= timedelta(days=rng.randint(4, 13))
    dates.reverse()
    deal.created_at = at(dates[0])  # type: ignore[assignment]
    for s, d in zip(path, dates, strict=True):
        deal.stage_events.append(DealStageEvent(stage=s, entered_at=at(d, 9) if s != stage else deal.stage_entered_at))
        db.add(Activity(kind=ActivityKind.STAGE_CHANGE, message=f"{code} moved to {stage_label(s)}",
                        payload={"code": code, "stage": s.value}, created_at=at(d)))
    for s, d in zip(path, dates, strict=True):
        for i, (kind, item_code, title) in enumerate(STAGE_CHECKLIST.get(s, [])):
            is_current = s == stage
            done = (i >= open_items) if (is_current and open_items is not None) else (not is_current or rng.random() < 0.45)
            deal.checklist.append(DealChecklistItem(stage=s, kind=kind, code=item_code, title=title, done=done,
                                                    done_at=at(d + timedelta(days=1)) if done else None))
    if stage in (DealStage.UNDER_CONTRACT, DealStage.CLOSING):
        prop.status = ListingStatus.PENDING
    if stage == DealStage.CLOSED:
        deal.closed_at = entered
        prop.status = ListingStatus.SOLD
        prop.sold_at = entered
        prop.sold_price = deal.offer_price
    if stage not in (DealStage.CLOSED, DealStage.LOST):
        deal.target_close_date = entered + timedelta(days=rng.randint(21, 60))
    db.add(deal)
    return deal


def listing_activity(p: Property) -> Activity:
    return Activity(kind=ActivityKind.LISTING_CREATED, message=f"New listing: {p.title}, {p.address}",
                    payload={"title": p.title, "address": p.address}, agent=p.agent, created_at=at(p.listed_at))


def link_activities(db: Session, deals: list[Deal]) -> None:
    for deal in deals:
        for act in db.scalars(select(Activity).where(Activity.message.like(f"{deal.code} %"))).all():
            act.deal_id, act.property_id, act.agent_id = deal.id, deal.property_id, deal.agent_id


def offer_activity(deal: Deal) -> Activity:
    lp = float(deal.property.list_price)
    pct = round((float(deal.offer_price) - lp) / lp * 100, 1)
    return Activity(kind=ActivityKind.OFFER_UPDATED, deal_id=deal.id, property_id=deal.property_id,
                    agent_id=deal.agent_id,
                    message=f"{deal.code} offer v{deal.offer_version}: EUR {float(deal.offer_price):,.0f} ({pct:+.1f}% vs list)",
                    payload={"code": deal.code, "version": deal.offer_version, "price": float(deal.offer_price), "pct": pct},
                    created_at=at(TODAY - timedelta(days=rng.randint(0, 3))))


def add_partner_details(clients: list[Client]) -> None:
    """Postal address + invoice payment date for the Partners page, with ~1 in 8 rows missing a field.

    Uses its own Random so the rest of the (deterministic) demo dataset is unchanged.
    """
    r = random.Random(7)
    for c in clients:
        hood = r.choice(HOODS)
        c.street = f"{r.choice(STREETS)} {r.randint(1, 140)}"
        c.postal_code, c.city = hood.plz, hood.city
        c.invoice_paid_at = TODAY - timedelta(days=r.randint(0, 420))
        if r.random() < 0.125:
            setattr(c, r.choice(["street", "postal_code", "city", "invoice_paid_at"]), None)


def seed(db: Session) -> None:
    rng.seed(42)  # deterministic dataset on every run
    seed_market(db)

    agents = [Agent(name=n, title=t, region=r, avatar_color=c, email=f"{ascii_slug(n)}@fityes.de",
                    phone=phone(r)) for n, t, r, c in AGENTS]
    db.add_all(agents)
    by_city = {r: [a for a in agents if a.region == r] for r in {a.region for a in agents}}

    clients = []
    for _ in range(80):
        name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        kind = rng.choices(list(ClientKind), weights=[65, 20, 15])[0]
        clients.append(Client(name=name, kind=kind, email=f"{ascii_slug(name)}@web.de",
                              phone=f"+49 1{rng.randint(51, 79)} {rng.randint(1000000, 9999999)}",
                              pre_approved_amount=money(rng.uniform(350_000, 1_800_000), 25_000)
                              if kind != ClientKind.SELLER else None))
    add_partner_details(clients)
    db.add_all(clients)

    props: list[Property] = []
    for i in range(1, 201):
        hood = rng.choice(HOODS)
        p = make_property(i, hood, rng.choice(by_city[hood.city]))
        props.append(p)
        db.add(p)
        db.add(listing_activity(p))
    db.flush()

    # Older listings mostly sold outside the tracked pipeline (historic sales).
    for p in props:
        age = (TODAY - p.listed_at).days
        if age > 45 and rng.random() < min(0.85, age / 200):
            p.status = ListingStatus.SOLD
            p.sold_at = p.listed_at + timedelta(days=rng.randint(10, min(age, 110)))
            p.sold_price = money(float(p.list_price) * rng.uniform(0.94, 1.04), 1000)
        elif age > 200 and rng.random() < 0.5:
            p.status = ListingStatus.OFF_MARKET

    active = [p for p in props if p.status == ListingStatus.ACTIVE and p.property_type != PropertyType.LAND]
    sold = [p for p in props if p.status == ListingStatus.SOLD]
    rng.shuffle(active)
    rng.shuffle(sold)

    # Hero deal: at Offer for 12 days, 1 check + 2 questions open.
    hero_prop = max(active, key=lambda p: (p.neighborhood == "Prenzlauer Berg", p.property_type == PropertyType.CONDO,
                                           float(p.list_price)))
    active.remove(hero_prop)
    hero = build_deal(db, "DL-0915-7731", hero_prop, clients[0], agents[0], DealStage.OFFER,
                      TODAY - timedelta(days=12), open_items=3)
    hero.offer_version, hero.down_payment_pct, hero.interest_rate = 6, Decimal(20), Decimal("3.650")

    deals = [hero]
    n = 1
    stage_mix = ([DealStage.LEAD] * 9 + [DealStage.VIEWING] * 10 + [DealStage.OFFER] * 8 +
                 [DealStage.UNDER_CONTRACT] * 7 + [DealStage.CLOSING] * 5 + [DealStage.LOST] * 6)
    for stage in stage_mix:
        if not active:
            break
        p = active.pop()
        n += 1
        deals.append(build_deal(db, f"DL-{p.listed_at:%m%d}-{1000 + n * 37}", p, rng.choice(clients[1:]),
                                p.agent or agents[0], stage, TODAY - timedelta(days=rng.randint(0, 20))))
    for p in sold[:40]:
        n += 1
        deal = build_deal(db, f"DL-{p.listed_at:%m%d}-{1000 + n * 37}", p, rng.choice(clients[1:]),
                          p.agent or agents[0], DealStage.CLOSED, p.sold_at)
        deal.offer_price = p.sold_price
        deals.append(deal)

    db.flush()
    link_activities(db, deals)
    for deal in deals:
        if deal.stage in (DealStage.OFFER, DealStage.UNDER_CONTRACT) and rng.random() < 0.6:
            db.add(offer_activity(deal))
    db.commit()


def add_more(db: Session, n: int) -> None:
    """Append `n` listings (≈40% with deals) to an already-seeded database."""
    agents = list(db.scalars(select(Agent)))
    clients = list(db.scalars(select(Client)))
    if not agents or not clients:
        raise SystemExit("No base data found. Run `python -m scripts.seed` first.")
    rng.seed(int(NOW.timestamp()))
    by_city = {r: [a for a in agents if a.region == r] for r in {a.region for a in agents}}
    start = (db.scalar(select(func.max(Property.id))) or 0) + 1

    props: list[Property] = []
    for i in range(n):
        hood = rng.choice(HOODS)
        p = make_property(start + i, hood, rng.choice(by_city.get(hood.city) or agents))
        props.append(p)
        db.add(p)
        db.add(listing_activity(p))
    db.flush()

    stages = [DealStage.LEAD, DealStage.VIEWING, DealStage.OFFER, DealStage.UNDER_CONTRACT,
              DealStage.CLOSING, DealStage.CLOSED, DealStage.LOST]
    deals: list[Deal] = []
    for p in props[: int(n * 0.4)]:
        if p.property_type == PropertyType.LAND:
            continue
        stage = rng.choices(stages, weights=[16, 18, 16, 14, 10, 18, 8])[0]
        age = (TODAY - p.listed_at).days
        entered = p.listed_at + timedelta(days=rng.randint(8, max(age, 9))) if stage == DealStage.CLOSED \
            else TODAY - timedelta(days=rng.randint(0, 20))
        deal = build_deal(db, f"DL-{p.id:05d}", p, rng.choice(clients), p.agent or agents[0], stage,
                          min(entered, TODAY))
        if stage == DealStage.CLOSED:
            deal.offer_price = p.sold_price = money(float(p.list_price) * rng.uniform(0.94, 1.04), 1000)
        deals.append(deal)
    db.flush()
    link_activities(db, deals)
    db.commit()


def reset(db: Session) -> None:
    for model in (Activity, DealChecklistItem, DealStageEvent, Deal, Property, Client, Agent, MarketSnapshot):
        db.execute(delete(model))
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="delete existing app data first")
    parser.add_argument("--add", type=int, metavar="N", help="append N more listings (with deals) to existing data")
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.add:
            add_more(db, args.add)
        else:
            if args.reset:
                reset(db)
            elif db.scalar(select(func.count(Property.id))):
                raise SystemExit("Data already present. Use --add N to append, or --reset to replace it.")
            seed(db)
        counts = {m.__tablename__: db.scalar(select(func.count()).select_from(m))
                  for m in (Agent, Client, Property, Deal, DealChecklistItem, Activity, MarketSnapshot)}
        print("Seeded:", ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    main()
