// Load test for the API (phase 4). What a real day looks like: people opening the
// Overview, scrolling their expenses, checking their group, and adding an expense now
// and then. See loadtest/README.md for how to run it.
//
//   RATE      requests per second to reach (default 100)
//   DURATION  how long to hold it (default 2m)
//   API       the API's address (default: the local Docker API, from inside k6's container)

import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";

const API = __ENV.API || "http://host.docker.internal:8000/api/v1";
const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || "2m";

// Made by `python -m loadtest.seed` (one access token per test user, and their group).
const people = new SharedArray("people", () => JSON.parse(open("../tokens.json")));

export const options = {
  scenarios: {
    day: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { target: RATE, duration: "30s" }, // warm up
        { target: RATE, duration: DURATION }, // hold
        { target: 0, duration: "10s" },
      ],
    },
  },
  // The goals written in docs/ROADMAP.md (phase 4). k6 exits with an error if missed.
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<300", "p(99)<800"],
    "http_req_duration{page:overview}": ["p(95)<300"],
    "http_req_duration{page:expenses}": ["p(95)<300"],
    "http_req_duration{page:group}": ["p(95)<300"],
    "http_req_duration{page:add}": ["p(95)<400"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const month = new Date().toISOString().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);

function get(path, person, page) {
  const response = http.get(`${API}${path}`, {
    headers: { Authorization: `Bearer ${person.token}` },
    tags: { page, name: path.replace(/[0-9a-f-]{36}/g, ":uuid").replace(/\d{4}-\d{2}/g, ":month") },
  });
  check(response, { [`${page} 200`]: (r) => r.status === 200 });
}

export default function () {
  const person = people[Math.floor(Math.random() * people.length)];
  const roll = Math.random();

  if (roll < 0.45) {
    // Opening the app: the Overview asks for these together.
    get(`/budgets/${month}`, person, "overview");
    get(`/budgets/${month}/daily`, person, "overview");
    get(`/expenses?month=${month}&limit=50`, person, "overview");
  } else if (roll < 0.65) {
    get(`/expenses?month=${month}&limit=50`, person, "expenses");
    get("/categories", person, "expenses");
  } else if (roll < 0.9 && person.group) {
    get("/groups", person, "group");
    get(`/groups/${person.group}`, person, "group");
    get(`/groups/${person.group}/balances`, person, "group");
    get(`/groups/${person.group}/activity?limit=30`, person, "group");
  } else {
    // Adding an expense (about 1 in 10).
    const categories = http.get(`${API}/categories`, {
      headers: { Authorization: `Bearer ${person.token}` },
      tags: { page: "add", name: "/categories" },
    });
    const food = categories.json().find((c) => c.slug === "food");
    const response = http.post(
      `${API}/expenses`,
      JSON.stringify({ amount: "42.50", description: "Load test", category_uuid: food.uuid, spent_at: today }),
      {
        headers: { Authorization: `Bearer ${person.token}`, "Content-Type": "application/json" },
        tags: { page: "add", name: "/expenses (POST)" },
      },
    );
    check(response, { "add 201": (r) => r.status === 201 });
  }
}
