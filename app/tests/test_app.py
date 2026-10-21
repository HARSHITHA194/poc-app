import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app  # noqa: E402


def test_health():
    client = app.test_client()
    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


def test_index_loads():
    client = app.test_client()
    res = client.get("/")
    assert res.status_code == 200
    assert b"CI/CD" in res.data


def test_post_message():
    client = app.test_client()
    res = client.post("/message", data={"name": "tester", "text": "hello"})
    assert res.status_code == 302
    page = client.get("/")
    assert b"hello" in page.data
