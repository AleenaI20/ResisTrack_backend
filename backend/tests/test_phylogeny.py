from collections.abc import AsyncIterator

import httpx
import pytest

from app.main import app
from app.models import PhylogenyBuildRequest
from app.phylogeny import PhylogenyError, build_phylogeny


def fasta(name: str, sequence: str) -> str:
    return f">{name}\n{sequence}\n"


GENOME_A = "ACGTTGCATGTCAGT" * 30
GENOME_B = "ACGTTGCATGTCAGT" * 25 + "ACGTTGCATGTCGGT" * 5
GENOME_C = "TTAGGCCTAACGGTA" * 30


def build_request() -> PhylogenyBuildRequest:
    return PhylogenyBuildRequest(
        genomes=[
            {"genome_id": "genome-c", "fasta": fasta("c", GENOME_C)},
            {"genome_id": "genome-a", "fasta": fasta("a", GENOME_A)},
            {"genome_id": "genome-b", "fasta": fasta("b", GENOME_B)},
        ],
        kmer_size=15,
        scaled=1,
        clade_distance_threshold=0.5,
    )


def test_build_phylogeny_returns_tree_distances_and_clades() -> None:
    result = build_phylogeny(build_request())

    assert result.genome_count == 3
    assert result.newick.endswith(";")
    assert all(genome_id in result.newick for genome_id in ("genome-a", "genome-b", "genome-c"))
    assert [row.genome_id for row in result.distance_matrix] == [
        "genome-a",
        "genome-b",
        "genome-c",
    ]
    assert result.distance_matrix[0].distances["genome-a"] == 0
    assert (
        result.distance_matrix[0].distances["genome-b"]
        == result.distance_matrix[1].distances["genome-a"]
    )
    assert len(result.clade_assignments) == 3
    assert (
        result.clade_assignments[0].clade_id
        == result.clade_assignments[1].clade_id
    )
    assert (
        result.clade_assignments[2].clade_id
        != result.clade_assignments[0].clade_id
    )


def test_build_phylogeny_rejects_non_fasta_input() -> None:
    request = PhylogenyBuildRequest(
        genomes=[
            {"genome_id": "one", "fasta": "ACGT" * 20},
            {"genome_id": "two", "fasta": fasta("two", "TGCA" * 20)},
        ],
        kmer_size=15,
        scaled=1,
    )

    with pytest.raises(PhylogenyError, match="input is not FASTA"):
        build_phylogeny(request)


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as test_client:
        yield test_client


@pytest.mark.asyncio
async def test_phylogeny_api_returns_versioned_output(
    client: httpx.AsyncClient,
) -> None:
    response = await client.post(
        "/api/phylogeny/build",
        json=build_request().model_dump(),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["schema_version"] == "1.0"
    assert payload["genome_count"] == 3
    assert payload["parameters"]["tree_method"].startswith("neighbor joining")


@pytest.mark.asyncio
async def test_phylogeny_api_validates_unique_genome_ids(
    client: httpx.AsyncClient,
) -> None:
    response = await client.post(
        "/api/phylogeny/build",
        json={
            "genomes": [
                {"genome_id": "duplicate", "fasta": fasta("one", GENOME_A)},
                {"genome_id": "duplicate", "fasta": fasta("two", GENOME_B)},
            ],
            "kmer_size": 15,
            "scaled": 1,
        },
    )

    assert response.status_code == 422
