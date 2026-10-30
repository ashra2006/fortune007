import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import client, bootstrap_admin
from admin_routes import router as admin_router
from pillar_routes import router as pillar_router

app = FastAPI(title="Fortune 007")


@app.get("/api/")
async def root():
    return {"message": "Fortune 007 API"}


app.include_router(admin_router)
app.include_router(pillar_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("startup")
async def startup():
    await bootstrap_admin()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
