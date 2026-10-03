from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.scan import router as scan_router
from backend.api.findings import router as findings_router
from backend.api.metrics import router as metrics_router

from backend.database.database import Base, engine
from backend.database import models


@asynccontextmanager
async def lifespan(app: FastAPI):

    Base.metadata.create_all(
        bind=engine
    )

    yield


app = FastAPI(
    title="Secret Leak Detector API",
    description="API for scanning codebases for exposed secrets.",
    version="1.0.0",
    lifespan=lifespan,
)


configured_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *configured_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(scan_router)
app.include_router(findings_router)
app.include_router(metrics_router)


@app.get("/")
def root():
    return {
        "message": "Secret Leak Detector API is running",
        "status": "ok",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }