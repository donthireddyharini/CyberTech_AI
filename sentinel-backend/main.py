"""
Sentinel AI — Context-Aware Content Moderation Intelligence Platform
Main FastAPI Application Entry Point
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import create_tables
from app.api.v1.router import api_router
from app.core.demo_data import seed_demo_data

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("Starting Sentinel AI backend...")
    await create_tables()
    if settings.DEMO_MODE:
        await seed_demo_data()
        logger.info("Demo data seeded.")
    logger.info("Sentinel AI backend ready.")
    yield
    logger.info("Sentinel AI backend shutting down...")


app = FastAPI(
    title="CyberTech AI API",
    description="Context-Aware Multilingual Hate Speech & Cyberbullying Detection API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware — support configured origins and local LAN network hostlinks
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/", tags=["root"])
async def root():
    return {
        "message": "Sentinel AI API is running",
        "version": "1.0.0",
        "docs": "/docs"
    }
