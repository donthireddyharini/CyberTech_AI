"""Main API router."""
from fastapi import APIRouter
from app.api.v1 import health, analyze, moderation, dashboard, feedback, evaluation, datasets, audit, project, monitor

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["Analysis"])
api_router.include_router(monitor.router, prefix="/monitor", tags=["Comment Monitoring"])
api_router.include_router(moderation.router, prefix="/moderation", tags=["Moderation"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["Feedback"])
api_router.include_router(evaluation.router, prefix="/evaluations", tags=["Evaluation"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
api_router.include_router(project.router, prefix="/project", tags=["Project"])
