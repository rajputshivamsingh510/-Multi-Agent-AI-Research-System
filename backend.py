"""
FastAPI backend for the Research Desk UI.

Serves the frontend (static/) and exposes a single endpoint that runs the
existing LangChain research pipeline (pipeline.run_research_pipeline) and
returns the final report + critique as JSON.
"""

import traceback
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from pipeline import run_research_pipeline

app = FastAPI(title="Research Desk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# The pipeline is blocking (sync LangChain calls), so run it off the event loop.
executor = ThreadPoolExecutor(max_workers=3)


class ResearchRequest(BaseModel):
    topic: str


class ResearchResponse(BaseModel):
    topic: str
    report: str
    feedback: str


@app.post("/api/research", response_model=ResearchResponse)
async def research(payload: ResearchRequest):
    topic = (payload.topic or "").strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")

    loop = __import__("asyncio").get_event_loop()
    try:
        state = await loop.run_in_executor(executor, run_research_pipeline, topic)
    except Exception as exc:  # surface pipeline errors as a clean 500
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {exc}") from exc

    return ResearchResponse(
        topic=topic,
        report=state.get("report", ""),
        feedback=state.get("feedback", ""),
    )


@app.get("/")
async def root():
    return FileResponse("static/index.html")


app.mount("/static", StaticFiles(directory="static"), name="static")
