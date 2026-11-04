import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")
import app as a  # noqa: E402

c = a.app.test_client()


def test_health():
    assert c.get("/api/health").json["db"]["connected"]


def test_track_and_404():
    r = c.get("/api/baggage/BG100001")
    assert r.status_code == 200 and r.json["events"]
    assert c.get("/api/baggage/NOPE").status_code == 404


def test_report_marks_missing():
    r = c.post("/api/reports", json={"passenger": "A", "email": "a@b.c", "flight": "ai101",
                                     "description": "blue bag", "tag": "BG100002"})
    assert r.status_code == 201
    assert c.get("/api/baggage/BG100002").json["bag"]["status"] == "Missing"


def test_validation():
    assert c.post("/api/reports", json={}).status_code == 400


def test_lost_found_flow():
    i = c.post("/api/lostfound", json={"item": "Umbrella", "description": "green", "found_at": "Gate 3"}).json["id"]
    assert c.patch(f"/api/lostfound/{i}", json={"status": "Claimed"}).status_code == 200
    assert any(x["id"] == i for x in c.get("/api/lostfound?q=umbrella").json)


def test_probe_health():
    assert c.get("/health").status_code == 200
