"""Version endpoint, request ids and JSON logs."""

import json
import logging

from app.core.observability import JsonFormatter
from tests.helpers import API


async def test_version_says_which_code_runs(client):
    body = (await client.get(f"{API}/version")).json()
    assert set(body) == {"commit", "environment"}
    assert len(body["commit"]) <= 7


async def test_every_answer_has_a_request_id(client):
    first = (await client.get(f"{API}/version")).headers["X-Request-ID"]
    second = (await client.get(f"{API}/version")).headers["X-Request-ID"]
    assert first != second


async def test_a_safe_incoming_request_id_is_kept_and_an_unsafe_one_replaced(client):
    kept = await client.get(f"{API}/version", headers={"X-Request-ID": "abc12345-req"})
    assert kept.headers["X-Request-ID"] == "abc12345-req"
    replaced = await client.get(f"{API}/version", headers={"X-Request-ID": "<script>alert(1)"})
    assert replaced.headers["X-Request-ID"] != "<script>alert(1)"


def test_log_lines_are_json_with_the_request_fields():
    record = logging.LogRecord("app.request", logging.INFO, __file__, 1, "request", None, None)
    record.fields = {"request_id": "r1", "path": "/api/v1/expenses", "status": 200}
    line = json.loads(JsonFormatter().format(record))
    assert line["message"] == "request"
    assert (line["path"], line["status"], line["request_id"]) == ("/api/v1/expenses", 200, "r1")
