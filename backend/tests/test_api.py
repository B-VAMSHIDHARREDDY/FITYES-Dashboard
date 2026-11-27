import pytest

from app.services.finance import monthly_payment, offer_breakdown

API = "/api/v1"


def test_monthly_payment_matches_amortization_formula():
    assert monthly_payment(400_000, 6.5, 30) == pytest.approx(2528.27, abs=0.01)
    assert monthly_payment(120_000, 0, 10) == pytest.approx(1000.0)
    assert monthly_payment(0, 6.5, 30) == 0


def test_offer_breakdown_components():
    b = offer_breakdown(offer_price=500_000, list_price=520_000, down_payment_pct=20, interest_rate=6.5,
                        loan_term_years=30, commission_rate=0.03, tax_annual=6_000, hoa_monthly=100)
    assert b.loan_amount == 400_000
    assert b.commission == pytest.approx(15_000)
    assert b.monthly_total == pytest.approx(2528.27 + 500 + 100, abs=0.01)
    assert b.delta_vs_list_pct == pytest.approx(-3.846, abs=0.001)


def test_health_and_counts(client):
    assert client.get(f"{API}/health").json() == {"status": "ok", "database": "up"}
    counts = client.get(f"{API}/meta/counts").json()
    assert counts["listings"] > 0 and counts["deals"] > 0


def test_property_filters_and_pagination(client):
    page = client.get(f"{API}/properties", params={"status": "active", "page_size": 5, "sort": "price_desc"}).json()
    prices = [p["list_price"] for p in page["items"]]
    assert len(prices) == 5 and prices == sorted(prices, reverse=True)
    assert all(p["status"] == "active" for p in page["items"])
    assert page["total"] >= 5


def test_create_and_reprice_property(client):
    body = {"title": "Test Bungalow", "address": "1 Test St", "city": "Berlin", "neighborhood": "Kreuzberg",
            "state": "BE", "zip_code": "10997", "property_type": "single_family", "list_price": 900000,
            "bedrooms": 3, "bathrooms": 2, "area_sqm": 95}
    created = client.post(f"{API}/properties", json=body)
    assert created.status_code == 201
    pid = created.json()["id"]
    updated = client.patch(f"{API}/properties/{pid}", json={"list_price": 875000}).json()
    assert updated["list_price"] == 875000
    feed = client.get(f"{API}/activities", params={"limit": 5}).json()
    assert any("price reduced" in a["message"] for a in feed)


def test_property_validation_rejects_bad_payload(client):
    assert client.post(f"{API}/properties", json={"title": "x"}).status_code == 422


def test_advance_blocked_until_checklist_resolved(client, hero_deal_id):
    deal = client.get(f"{API}/deals/{hero_deal_id}").json()
    assert deal["stage"] == "offer"

    blocked = client.post(f"{API}/deals/{hero_deal_id}/advance")
    assert blocked.status_code == 409
    assert "3 open item" in blocked.json()["message"]

    for item in deal["checklist"]:
        if item["stage"] == "offer" and not item["done"]:
            r = client.patch(f"{API}/deals/{hero_deal_id}/checklist/{item['id']}", json={"done": True})
            assert r.status_code == 200

    advanced = client.post(f"{API}/deals/{hero_deal_id}/advance").json()
    assert advanced["stage"] == "under_contract"
    assert advanced["property"]["status"] == "pending"
    assert advanced["stage_events"][-1]["stage"] == "under_contract"
    assert any(i["stage"] == "under_contract" and not i["done"] for i in advanced["checklist"])


def test_offer_update_versions_only_on_change(client, hero_deal_id):
    deal = client.get(f"{API}/deals/{hero_deal_id}").json()
    terms = {k: deal["offer"][k] for k in
             ("offer_price", "down_payment_pct", "interest_rate", "loan_term_years", "commission_rate")}

    same = client.put(f"{API}/deals/{hero_deal_id}/offer", json=terms).json()
    assert same["offer"]["offer_version"] == deal["offer"]["offer_version"]

    changed = client.put(f"{API}/deals/{hero_deal_id}/offer", json={**terms, "offer_price": 777_000}).json()
    assert changed["offer"]["offer_version"] == deal["offer"]["offer_version"] + 1
    assert changed["breakdown"]["offer_price"] == 777_000


def test_offer_locked_after_contract_stage(client):
    closing = client.get(f"{API}/deals", params={"stage": "closing", "page_size": 1}).json()["items"][0]
    detail = client.get(f"{API}/deals/{closing['id']}").json()
    terms = {k: detail["offer"][k] for k in
             ("offer_price", "down_payment_pct", "interest_rate", "loan_term_years", "commission_rate")}
    r = client.put(f"{API}/deals/{closing['id']}/offer", json={**terms, "offer_price": 1})
    assert r.status_code == 409


def test_mark_lost_then_cannot_advance(client, hero_deal_id):
    lost = client.post(f"{API}/deals/{hero_deal_id}/lost", json={"reason": "Buyer chose another home"}).json()
    assert lost["stage"] == "lost"
    assert client.post(f"{API}/deals/{hero_deal_id}/advance").status_code == 409


def test_unknown_deal_returns_404(client):
    r = client.get(f"{API}/deals/999999")
    assert r.status_code == 404 and r.json()["code"] == "not_found"


def test_dashboard_and_market_shapes(client):
    summary = client.get(f"{API}/dashboard/summary").json()
    assert {k["key"] for k in summary["kpis"]} >= {"active_listings", "sales_volume", "pipeline_value"}
    assert summary["generated_at"].endswith("Z") or "+00:00" in summary["generated_at"]
    trends = client.get(f"{API}/market/trends", params={"months": 12}).json()
    assert len(trends) == 12
    hoods = client.get(f"{API}/market/neighborhoods").json()
    assert len(hoods) == 12 and all(len(h["sparkline"]) == 12 for h in hoods)
    pipeline = client.get(f"{API}/dashboard/pipeline").json()
    assert [p["stage"] for p in pipeline][:3] == ["lead", "viewing", "offer"]
