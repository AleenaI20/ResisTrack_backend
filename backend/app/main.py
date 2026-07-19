from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, NoReturn

import httpx
from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app.amrfinder import (
    AmrFinderClient,
    AmrFinderError,
    AmrFinderInputError,
    AmrFinderResponseError,
)
from app.config import Settings
from app.models import (
    AmrFinderRequest,
    AmrFinderResponse,
    AmrFinderStatusResponse,
    GenomeSearchResponse,
    GenomeSequenceResponse,
    PhylogenyBuildRequest,
    PhylogenyBuildResponse,
)
from app.ncbi import NcbiClient, NcbiError, NcbiResponseError
from app.phylogeny import PhylogenyError, build_phylogeny

settings = Settings.from_environment()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    ncbi_timeout = httpx.Timeout(30.0, connect=10.0)
    amrfinder_timeout = httpx.Timeout(300.0, connect=15.0)
    async with httpx.AsyncClient(
        timeout=ncbi_timeout,
        headers={"User-Agent": "Resistrace/0.1"},
    ) as ncbi_http_client, httpx.AsyncClient(
        timeout=amrfinder_timeout,
        headers={"User-Agent": "Resistrace/0.1"},
    ) as amrfinder_http_client:
        app.state.ncbi = NcbiClient(
            ncbi_http_client,
            email=settings.ncbi_email,
            api_key=settings.ncbi_api_key,
        )
        app.state.amrfinder = AmrFinderClient(
            amrfinder_http_client,
            base_url=settings.amrfinderplus_api_url,
        )
        yield


app = FastAPI(
    title="Resistrace API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def get_ncbi_client(request: Request) -> NcbiClient:
    return request.app.state.ncbi


def get_amrfinder_client(request: Request) -> AmrFinderClient:
    return request.app.state.amrfinder


NcbiDependency = Annotated[NcbiClient, Depends(get_ncbi_client)]
AmrFinderDependency = Annotated[
    AmrFinderClient,
    Depends(get_amrfinder_client),
]


def raise_upstream_error(exc: NcbiError) -> NoReturn:
    detail = str(exc)
    if isinstance(exc, NcbiResponseError):
        raise HTTPException(status_code=502, detail=detail) from exc
    raise HTTPException(status_code=503, detail=detail) from exc


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/amrfinderplus/status",
    response_model=AmrFinderStatusResponse,
)
async def amrfinderplus_status(
    amrfinder: AmrFinderDependency,
) -> AmrFinderStatusResponse:
    return await amrfinder.status()


@app.post("/api/amrfinderplus", response_model=AmrFinderResponse)
async def analyze_amr_markers(
    payload: AmrFinderRequest,
    amrfinder: AmrFinderDependency,
) -> AmrFinderResponse:
    try:
        return await amrfinder.analyze(payload)
    except AmrFinderInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AmrFinderResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except AmrFinderError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/ncbi/genomes/search", response_model=GenomeSearchResponse)
async def search_genomes(
    organism: Annotated[
        str,
        Query(
            min_length=2,
            max_length=120,
            description="Scientific or common organism name",
        ),
    ],
    ncbi: NcbiDependency,
    limit: Annotated[int, Query(ge=1, le=10)] = 5,
) -> GenomeSearchResponse:
    normalized_organism = " ".join(organism.split())
    try:
        return await ncbi.search_genomes(normalized_organism, limit)
    except NcbiError as exc:
        raise_upstream_error(exc)


@app.get("/api/ncbi/genomes/{uid}", response_model=GenomeSequenceResponse)
async def fetch_genome(
    uid: Annotated[str, Path(pattern=r"^\d+$", max_length=32)],
    ncbi: NcbiDependency,
) -> GenomeSequenceResponse:
    try:
        return await ncbi.fetch_genome(uid)
    except NcbiError as exc:
        raise_upstream_error(exc)


@app.post("/api/phylogeny/build", response_model=PhylogenyBuildResponse)
async def create_phylogenetic_tree(
    payload: PhylogenyBuildRequest,
) -> PhylogenyBuildResponse:
    try:
        return await run_in_threadpool(build_phylogeny, payload)
    except PhylogenyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
