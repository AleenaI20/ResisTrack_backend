import asyncio
import time
from collections.abc import Mapping

import httpx

from app.models import GenomeSearchResponse, GenomeSearchResult, GenomeSequenceResponse

EUTILS_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
MAX_SEQUENCE_LENGTH = 25_000_000


class NcbiError(Exception):
    """Base exception for NCBI integration failures."""


class NcbiNotFoundError(NcbiError):
    """Raised when NCBI has no matching record."""


class NcbiResponseError(NcbiError):
    """Raised when NCBI returns malformed or unexpectedly large data."""


class NcbiRateLimiter:
    def __init__(self, requests_per_second: int) -> None:
        self._minimum_interval = 1 / requests_per_second
        self._last_request_at = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            elapsed = time.monotonic() - self._last_request_at
            remaining = self._minimum_interval - elapsed
            if remaining > 0:
                await asyncio.sleep(remaining)
            self._last_request_at = time.monotonic()


def parse_fasta(fasta_text: str) -> tuple[str, str]:
    lines = [line.strip() for line in fasta_text.splitlines() if line.strip()]
    if not lines or not lines[0].startswith(">"):
        raise NcbiResponseError("NCBI returned an invalid FASTA record.")

    header = lines[0][1:].strip()
    sequence = "".join(lines[1:]).replace(" ", "").upper()
    if not sequence:
        raise NcbiResponseError("NCBI returned a FASTA record without a sequence.")
    if len(sequence) > MAX_SEQUENCE_LENGTH:
        raise NcbiResponseError(
            f"The selected sequence exceeds the {MAX_SEQUENCE_LENGTH:,} base limit."
        )
    return header, sequence


class NcbiClient:
    def __init__(
        self,
        http_client: httpx.AsyncClient,
        *,
        email: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self._http = http_client
        self._email = email
        self._api_key = api_key
        self._limiter = NcbiRateLimiter(10 if api_key else 3)

    def _common_params(self) -> dict[str, str]:
        params = {"tool": "resistrace"}
        if self._email:
            params["email"] = self._email
        if self._api_key:
            params["api_key"] = self._api_key
        return params

    async def _get(
        self, endpoint: str, params: Mapping[str, str | int]
    ) -> httpx.Response:
        await self._limiter.wait()
        try:
            response = await self._http.get(
                f"{EUTILS_BASE_URL}/{endpoint}",
                params={**self._common_params(), **params},
            )
            response.raise_for_status()
            return response
        except httpx.TimeoutException as exc:
            raise NcbiError("NCBI did not respond before the request timed out.") from exc
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status == 429:
                raise NcbiError("NCBI rate limit reached. Please retry shortly.") from exc
            raise NcbiError(f"NCBI returned HTTP {status}.") from exc
        except httpx.RequestError as exc:
            raise NcbiError("Unable to connect to NCBI.") from exc

    async def search_genomes(
        self, organism: str, limit: int
    ) -> GenomeSearchResponse:
        search_response = await self._get(
            "esearch.fcgi",
            {
                "db": "nuccore",
                "term": (
                    f'"{organism}"[Organism] AND biomol_genomic[PROP] '
                    'AND ("complete genome"[Title] OR "complete sequence"[Title] '
                    "OR chromosome[Title])"
                ),
                "retmax": limit,
                "retmode": "json",
                "sort": "relevance",
            },
        )
        try:
            ids = search_response.json()["esearchresult"]["idlist"]
        except (KeyError, TypeError, ValueError) as exc:
            raise NcbiResponseError("NCBI returned an invalid search response.") from exc

        if not ids:
            return GenomeSearchResponse(organism=organism, results=[])

        summary_response = await self._get(
            "esummary.fcgi",
            {
                "db": "nuccore",
                "id": ",".join(ids),
                "retmode": "json",
            },
        )
        try:
            payload = summary_response.json()["result"]
            results = [
                self._parse_summary(uid, payload[uid])
                for uid in payload["uids"]
                if uid in payload
            ]
        except (KeyError, TypeError, ValueError) as exc:
            raise NcbiResponseError("NCBI returned invalid genome summaries.") from exc

        return GenomeSearchResponse(organism=organism, results=results)

    @staticmethod
    def _parse_summary(uid: str, item: Mapping[str, object]) -> GenomeSearchResult:
        accession = str(item.get("accessionversion") or item.get("caption") or uid)
        title = str(item.get("title") or accession)
        try:
            length = int(item.get("slen") or 0)
        except (TypeError, ValueError):
            length = 0
        updated_at_value = item.get("updatedate")
        return GenomeSearchResult(
            uid=uid,
            accession=accession,
            title=title,
            length=length,
            updated_at=str(updated_at_value) if updated_at_value else None,
        )

    async def fetch_genome(self, uid: str) -> GenomeSequenceResponse:
        response = await self._get(
            "efetch.fcgi",
            {
                "db": "nuccore",
                "id": uid,
                "rettype": "fasta",
                "retmode": "text",
            },
        )
        header, sequence = parse_fasta(response.text)
        accession = header.split(maxsplit=1)[0]
        return GenomeSequenceResponse(
            uid=uid,
            accession=accession,
            header=header,
            sequence=sequence,
            length=len(sequence),
        )
