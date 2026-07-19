from collections.abc import AsyncIterator
import json

import httpx
import pytest

from app.amrfinder import (
    AmrFinderClient,
    AmrFinderInputError,
    build_detected_features,
    parse_amrfinder_output,
    predict_proteins_from_fasta,
)
from app.main import app, get_amrfinder_client
from app.models import (
    AmrFinderRequest,
    AmrFinderResponse,
    AmrFinderStatusResponse,
)

AMRFINDER_OUTPUT = (
    "Gene symbol\tElement subtype\tSequence name\tClass\n"
    "blaKPC\tAMR\tKPC family beta-lactamase\tBETA-LACTAM\n"
    "gyrA\tPOINT\tgyrA_S83L\tQUINOLONE\n"
)


def test_parse_output_builds_positive_feature_map() -> None:
    findings = parse_amrfinder_output(AMRFINDER_OUTPUT)

    assert len(findings) == 2
    assert build_detected_features(findings) == {
        "gene:blaKPC": True,
        "gene:gyrA": True,
        "mutation:gyrA_S83L": True,
    }


def test_predict_proteins_from_nucleotide_fasta_in_memory() -> None:
    fasta = (
        ">contig\n"
        "ATGAAAACCGCCTACCTGATTCTGGCCGCCGCCCTGGTGATTCTGGCCGCCGCC"
        "CTGGTGATTCTGGCCGGCGGCATTGTGACCTACTTCTTCCGCAAAAAACGCTAA\n"
    )

    protein_fasta, protein_count = predict_proteins_from_fasta(fasta)

    assert protein_count == 1
    assert protein_fasta == (
        ">contig_1\nMKTAYLILAAALVILAAALVILAGGIVTYFFRKKR\n"
    )
    assert "*" not in protein_fasta


@pytest.mark.asyncio
async def test_client_sends_predicted_proteins_to_hosted_api() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert request.url.path == "/api/amrfinderplus"
        assert payload == {"fasta": ">protein_1\nMAAAAA\n"}
        return httpx.Response(
            200,
            json={
                "success": True,
                "service": "amrfinderplus",
                "returncode": 0,
                "output": AMRFINDER_OUTPUT,
                "stderr": "",
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler)
    ) as http_client:
        client = AmrFinderClient(
            http_client,
            base_url="https://example.test",
            protein_predictor=lambda _: (">protein_1\nMAAAAA\n", 1),
        )
        result = await client.analyze(
            AmrFinderRequest(
                fasta=">genome\nACGTTGCATGTCAGT\n",
                organism="Escherichia",
            )
        )

    assert result.finding_count == 2
    assert result.predicted_protein_count == 1
    assert result.detected_features["gene:blaKPC"] is True


def test_protein_prediction_rejects_amino_acid_input() -> None:
    with pytest.raises(AmrFinderInputError, match="non-nucleotide"):
        predict_proteins_from_fasta(
            ">protein\nMKTAYLILAAALVILAAALVILAGGIVTYFFRKKR\n"
        )


class FakeAmrFinderClient:
    async def status(self) -> AmrFinderStatusResponse:
        return AmrFinderStatusResponse(
            configured=True,
            reachable=True,
            protein_mode_ready=True,
            detail="Ready.",
        )

    async def analyze(
        self, request: AmrFinderRequest
    ) -> AmrFinderResponse:
        findings = parse_amrfinder_output(AMRFINDER_OUTPUT)
        return AmrFinderResponse(
            organism=request.organism,
            predicted_protein_count=2,
            finding_count=len(findings),
            findings=findings,
            detected_features=build_detected_features(findings),
            raw_output=AMRFINDER_OUTPUT,
        )


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    app.dependency_overrides[get_amrfinder_client] = (
        lambda: FakeAmrFinderClient()
    )
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_amrfinder_client, None)


@pytest.mark.asyncio
async def test_amrfinder_api_returns_standardized_findings(
    client: httpx.AsyncClient,
) -> None:
    response = await client.post(
        "/api/amrfinderplus",
        json={
            "fasta": ">genome\nACGTTGCATGTCAGT\n",
            "organism": "Escherichia",
        },
    )

    assert response.status_code == 200
    assert response.json()["finding_count"] == 2
    assert response.json()["detected_features"]["gene:blaKPC"] is True
