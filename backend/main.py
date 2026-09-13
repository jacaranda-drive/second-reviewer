import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:%(name)s:%(message)s",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db
from routers import reviews, records, agent, irr, export, prisma, fulltext, extraction


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="AI Second Reviewer",
    description="AI second reviewer for scoping review on responsible AI in LMIC primary care",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reviews.router)
app.include_router(records.router)
app.include_router(agent.router)
app.include_router(irr.router)
app.include_router(export.router)
app.include_router(prisma.router)
app.include_router(fulltext.router)
app.include_router(extraction.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/config")
async def config():
    """Return active LLM provider config (for Dashboard display)."""
    import os
    return {
        "llm_provider": os.getenv("LLM_PROVIDER", "openai"),
        "llm_model": os.getenv("OPENAI_MODEL", "gpt-4o") if os.getenv("LLM_PROVIDER", "openai") == "openai"
        else os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
    }
