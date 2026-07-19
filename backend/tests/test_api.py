from collections.abc import AsyncIterator

import httpx
import pytest

from app.main import app, get_ncbi_client, get_predictor
from app.models import (
    AntibioticPrediction,
    GenomeSearchResponse,
    GenomeSearchResult,
    GenomeSequenceResponse,
    PredictRequest,
    PredictResponse,
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


class FakePredictor:
    def predict(self, payload: PredictRequest) -> PredictResponse:
        return PredictResponse(
            organism=payload.organism,
            supported_species="Klebsiella pneumoniae",
            predictions=[
                AntibioticPrediction(
                    drug="meropenem",
                    call="likely_to_fail",
                    confidence=0.91,
                    resistance_probability=0.91,
                    evidence_category="known_resistance_marker",
                    supporting_features=["gene:blaKPC"],
                    model_tier="Strong",
                    no_call_margin=0.15,
                    target_gate_status="not_required_for_fail_call",
                    call_reason="Resistance probability exceeded threshold.",
                )
            ],
            matched_features=["gene:blaKPC"],
            unmatched_features=[],
            disclaimer="Confirm with standard laboratory testing.",
        )


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    app.dependency_overrides[get_ncbi_client] = lambda: FakeNcbiClient()
    app.dependency_overrides[get_predictor] = lambda: FakePredictor()
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


@pytest.mark.asyncio
async def test_predict_endpoint_returns_model_results(
    client: httpx.AsyncClient,
) -> None:
    response = await client.post(
        "/api/predict",
        json={
            "detected_features": {"gene:blaKPC": True},
            "organism": "Klebsiella pneumoniae",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["predictions"][0]["call"] == "likely_to_fail"
    assert body["matched_features"] == ["gene:blaKPC"]


@pytest.mark.asyncio
async def test_predict_meta_endpoint_returns_model_scope(
    client: httpx.AsyncClient,
) -> None:
    class MetaPredictor:
        def metadata(self):
            from app.models import PredictMetaResponse

            return PredictMetaResponse(
                supported_species="Klebsiella pneumoniae",
                drugs=["meropenem"],
                gene_columns=["KPC", "NDM"],
                demo_markers=["KPC", "NDM"],
            )

    app.dependency_overrides[get_predictor] = lambda: MetaPredictor()
    response = await client.get("/api/predict/meta")

    assert response.status_code == 200
    assert response.json()["demo_markers"] == ["KPC", "NDM"]
    assert response.json()["supported_species"] == "Klebsiella pneumoniae"
