# BudgetBuddy

**AI Expense Tracker & Savings Coach for Students**

> 🚧 Work in progress. A full README with screenshots arrives at the end of the build (Phase 8).

Students rarely know where their allowance goes, whether it will last until the end of the month, or how to save from it. BudgetBuddy tracks spending, splits the budget into categories, warns before the money runs out, and uses Claude to categorize expenses, give personal saving tips, and answer questions like *"How much did I spend on food this week?"*.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Motion |
| Backend | Python, FastAPI, SQLAlchemy 2 (async), Alembic |
| Database | PostgreSQL |
| AI | Anthropic Claude API |
| DevOps | Docker, GitHub Actions |

The full architecture is documented in [`docs/SAD.docx`](docs/SAD.docx).

## Run locally

Requires Docker Desktop.

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

Then open:

- API health check: http://localhost:8000/api/v1/health
- Interactive API docs: http://localhost:8000/docs

## Run the backend tests

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (macOS/Linux: source .venv/bin/activate)
python -m pip install --timeout 120 -e ".[dev]"
python -m pytest
```

## Author

**Mouhammed Altaweel** · [LinkedIn](https://www.linkedin.com/in/mouhammed-altaweel) · [GitHub](https://github.com/M-ALTAWEEL)
