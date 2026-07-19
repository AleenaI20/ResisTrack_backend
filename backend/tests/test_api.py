from collections.abc import AsyncIterator

import httpx
import pytest

from app.main import app, get_ncbi_client
from app.models import (
    GenomeSearchResponse,
    GenomeSearchResult,
    GenomeSequenceResponse,
)


class FakeNcbiClient:
    async def search_genomes(
        self, organism: str, limit: int
    ) -> GenomeSearchResponse:
        return GenomeSearchResponse(
            organism=organism,
            results=[
                GenomeSearchResult(
                    uid="123",
                    accession="NC_000001.1",
                    title="Example complete genome",
                    length=8,
                )
            ][:limit],
        )

    async def fetch_genome(self, uid: str) -> GenomeSequenceResponse:
        return GenomeSequenceResponse(
            uid=uid,
            accession="NC_000001.1",
            header="NC_000001.1 Example complete genome",
            sequence="ATGCAANN",
            length=8,
        )


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    app.dependency_overrides[get_ncbi_client] = lambda: FakeNcbiClient()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_search_endpoint_normalizes_organism(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get(
        "/api/ncbi/genomes/search",
        params={"organism": "  Example   bacterium  ", "limit": 5},
    )

    assert response.status_code == 200
    assert response.json()["organism"] == "Example bacterium"
    assert response.json()["results"][0]["uid"] == "123"


@pytest.mark.asyncio
async def test_fetch_endpoint_returns_in_memory_sequence(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get("/api/ncbi/genomes/123")

    assert response.status_code == 200
    assert response.json()["sequence"] == "ATGCAANN"


@pytest.mark.asyncio
async def test_fetch_endpoint_rejects_non_numeric_uid(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get("/api/ncbi/genomes/not-an-id")

    assert response.status_code == 422
