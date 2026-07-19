import httpx
import pytest

from app.ncbi import NcbiClient, NcbiResponseError, parse_fasta


def test_parse_fasta_joins_sequence_lines() -> None:
    header, sequence = parse_fasta(">NC_000001.1 example genome\nATGC\nNNRY\n")

    assert header == "NC_000001.1 example genome"
    assert sequence == "ATGCNNRY"


def test_parse_fasta_rejects_non_fasta_response() -> None:
    with pytest.raises(NcbiResponseError, match="invalid FASTA"):
        parse_fasta("not a fasta record")


@pytest.mark.asyncio
async def test_search_genomes_returns_ncbi_summaries() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/esearch.fcgi"):
            return httpx.Response(
                200,
                json={"esearchresult": {"idlist": ["123"]}},
            )
        if request.url.path.endswith("/esummary.fcgi"):
            return httpx.Response(
                200,
                json={
                    "result": {
                        "uids": ["123"],
                        "123": {
                            "uid": "123",
                            "accessionversion": "NC_000001.1",
                            "title": "Example complete genome",
                            "slen": 4200000,
                            "updatedate": "2026/01/01",
                        },
                    }
                },
            )
        raise AssertionError(f"Unexpected request: {request.url}")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = NcbiClient(http, api_key="test-key")
        response = await client.search_genomes("Example bacterium", 5)

    assert response.organism == "Example bacterium"
    assert len(response.results) == 1
    assert response.results[0].accession == "NC_000001.1"
    assert response.results[0].length == 4200000


@pytest.mark.asyncio
async def test_fetch_genome_keeps_sequence_in_memory() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/efetch.fcgi")
        return httpx.Response(
            200,
            text=">NC_000001.1 Example complete genome\nATGC\nAANN\n",
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = NcbiClient(http, api_key="test-key")
        genome = await client.fetch_genome("123")

    assert genome.accession == "NC_000001.1"
    assert genome.sequence == "ATGCAANN"
    assert genome.length == 8
