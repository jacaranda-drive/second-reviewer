# AI Second Reviewer

A locally hosted web application for conducting and documenting an AI-assisted scoping review. It was developed for the review **"Implementing Responsible AI in LMIC Primary Care"** and supports a human reviewer while preserving human oversight and an auditable decision trail.

The application imports bibliographic records, records independent human and AI screening decisions, highlights disagreements, calculates inter-rater reliability (IRR), supports full-text review and data extraction, and generates review exports and PRISMA figures.

## Key features

- Import records from CSV (including Covidence exports) or RIS files
- Conduct title/abstract and later-phase human screening
- Run an AI reviewer using OpenAI or Anthropic models
- Keep human and AI decisions independent during screening
- Compare decisions and resolve conflicts manually
- Calculate percentage agreement and Cohen's kappa
- Manage full-text review and structured data extraction
- Export decisions, audit data, and Zotero-compatible files
- View PRISMA flow data in a dashboard
- Store project data locally in SQLite

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Query, Recharts |
| Backend | Python, FastAPI, SQLAlchemy (async) |
| Database | SQLite |
| AI providers | OpenAI or Anthropic |

## Project structure

```text
.
├── backend/                    # FastAPI application, screening agent and database
│   ├── agent/                  # Criteria, prompts and LLM provider adapters
│   ├── db/                     # SQLAlchemy models and SQLite configuration
│   ├── parsers/                # CSV and RIS importers
│   └── routers/                # API endpoints
├── frontend/                   # React/TypeScript user interface
├── dissertation_evidence/      # Working research outputs and audit evidence (see below)
├── screening_agent_documentation.md
└── agent_calibration_guide.md
```

`dissertation_evidence/` contains intermediate outputs generated during the review. These are working files, not the published record. The authoritative protocol, screening audit log, prompts, and inter-rater reliability statistics are deposited on the Open Science Framework (see [Associated research outputs](#associated-research-outputs)).

## Prerequisites

- Python 3.11 or later
- Node.js 20 or later and npm
- An OpenAI or Anthropic API key if you want to run AI screening

The application can still be used for importing, human screening, reviewing existing decisions, and exports without an API key. An API key is required only when calling the selected AI provider.

## Installation

Clone the repository:

```bash
git clone <your-repository-url>
cd Second-Reviewer
```

### 1. Set up the backend

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```bash
source .venv/bin/activate
```

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

Create a file named `.env` inside `backend/` and configure one provider.

For OpenAI:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o
```

For Anthropic:

```dotenv
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_MODEL=your_model_identifier_here
```

The OpenAI path is the one used for the screening reported in the associated dissertation. The Anthropic adapter is implemented but was not used in that work; consult the provider's current model documentation for a valid identifier, as these change over time. Any model name must be available to your provider account.

Optional timeout settings are `LLM_TIMEOUT_SECONDS` and `LLM_RECORD_TIMEOUT_SECONDS`.

Start the API from the `backend/` directory:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive API documentation is available at `http://localhost:8000/docs`, and the health check is `http://localhost:8000/health`.

The SQLite database is created automatically at `backend/data/reviews.db` on first startup.

### 2. Set up the frontend

Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in a browser. During development, Vite proxies frontend requests from `/api` to the backend at `http://localhost:8000`.

## Typical workflow

1. Create a review from the home page.
2. Import bibliographic records from a supported CSV or RIS file.
3. Complete human screening without viewing AI decisions.
4. Configure an AI provider and run the second reviewer.
5. Compare decisions and inspect agreement statistics.
6. Resolve conflicts, retaining the human reviewer as the final decision-maker.
7. Continue to full-text screening and extraction where applicable.
8. Export decisions, audit evidence, and PRISMA data.

The screening agent returns a structured decision, confidence score, rationale, criterion-level assessment, evidence quotations, and flags. `Uncertain` decisions are intended for human review rather than automatic exclusion.

## Verification

Build and lint the frontend with:

```bash
cd frontend
npm run lint
npm run build
```

Check that the backend starts successfully, then request its health endpoint:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Data, privacy, and reproducibility

- The operational database, environment files, PDFs, and large local audit logs are excluded by `.gitignore`.
- Never commit API keys, participant information, copyrighted PDFs, or sensitive review data.
- AI outputs should be treated as reviewer recommendations, not authoritative decisions.
- Reproducing model decisions may depend on provider access, model version, prompt version, and sampling behaviour.
- The human reviewer retains responsibility for eligibility decisions and conflict resolution.

One limitation of the deposited record should be noted. Although the application stores criterion-level assessments and evidence quotations for every phase, those fields were lost for the 81 full-text records during a database restoration from an intermediate CSV export that did not carry them. They were subsequently recovered from a dated database backup at export time, and the published audit log discloses this. Neither database was modified in the course of the recovery.

Methodological details, screening criteria, prompt calibration, IRR interpretation, and known limitations are documented in [screening_agent_documentation.md](screening_agent_documentation.md). The calibration procedure is described in [agent_calibration_guide.md](agent_calibration_guide.md).

## Associated research outputs

The registered protocol, protocol amendments, complete screening audit log, agent prompts for each screening phase, inter-rater reliability statistics, and database schema are deposited at [osf.io/9e3qt](https://osf.io/9e3qt), under embargo until October 2026.

Where a figure appears both in this repository and in the OSF deposit, the OSF version is authoritative.

## Academic context

This software was created as part of an Oxford MSc in Global Healthcare Leadership dissertation (2026). If reusing the application or methodology, cite the associated dissertation or repository according to your institution's requirements.

## Licence

The source is published for inspection and academic scrutiny in support of the associated dissertation. No open-source licence is granted: copyright remains with the repository owner, and reuse, redistribution, or derivative work requires prior written permission.
