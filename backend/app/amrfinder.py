import asyncio
import csv
import re
from io import StringIO
from typing import Any, Callable

import httpx
import pyrodigal
from Bio import SeqIO

from app.models import (
    AmrFinderRequest,
    AmrFinderResponse,
    AmrFinderStatusResponse,
)

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")
SAFE_IDENTIFIER = re.compile(r"[^A-Za-z0-9_.:-]+")
IUPAC_DNA = frozenset("ACGTRYSWKMBDHVN")
ProteinPredictor = Callable[[str], tuple[str, int]]


class AmrFinderError(Exception):
    """Base exception for the hosted AMRFinderPlus integration."""


class AmrFinderResponseError(AmrFinderError):
    """Raised when the hosted service rejects input or returns invalid data."""


class AmrFinderInputError(AmrFinderError):
    """Raised when nucleotide FASTA cannot be converted into proteins."""


def predict_proteins_from_fasta(fasta: str) -> tuple[str, int]:
    records = list(SeqIO.parse(StringIO(fasta), "fasta"))
    if not records:
        raise AmrFinderInputError("Input must contain at least one FASTA record.")

    sequences: list[bytes] = []
    for record in records:
        sequence = "".join(str(record.seq).split()).upper()
        invalid = sorted(set(sequence) - IUPAC_DNA)
        if invalid:
            raise AmrFinderInputError(
                "Genome FASTA contains non-nucleotide characters: "
                + ", ".join(invalid[:10])
            )
        if not sequence:
            raise AmrFinderInputError(
                f"FASTA record {record.id} contains no sequence data."
            )
        sequences.append(sequence.encode("ascii"))

    total_length = sum(map(len, sequences))
    use_metagenomic_mode = total_length < 100_000
    gene_finder = pyrodigal.GeneFinder(meta=use_metagenomic_mode)
    if not use_metagenomic_mode:
        try:
            gene_finder.train(sequences[0], *sequences[1:])
        except ValueError as exc:
            raise AmrFinderInputError(
                f"Prodigal could not train on this genome: {exc}"
            ) from exc

    protein_records: list[str] = []
    protein_count = 0
    for record, sequence in zip(records, sequences, strict=True):
        sequence_id = SAFE_IDENTIFIER.sub("_", record.id).strip("_") or "contig"
        try:
            genes = gene_finder.find_genes(sequence)
        except (RuntimeError, ValueError) as exc:
            raise AmrFinderInputError(
                f"Prodigal could not predict genes in {record.id}: {exc}"
            ) from exc

        for gene_index, gene in enumerate(genes, start=1):
            translation = gene.translate(include_stop=False)
            if not translation:
                continue
            protein_count += 1
            protein_records.extend(
                (
                    f">{sequence_id}_{gene_index}",
                    str(translation),
                )
            )

    if not protein_records:
        raise AmrFinderInputError(
            "Prodigal did not find any protein-coding genes in this FASTA."
        )
    return "\n".join(protein_records) + "\n", protein_count


def parse_amrfinder_output(output: str) -> list[dict[str, str]]:
    if not output.strip():
        return []
    reader = csv.DictReader(StringIO(output), delimiter="\t")
    if not reader.fieldnames:
        raise AmrFinderResponseError(
            "AMRFinderPlus returned output without a TSV header."
        )
    return [
        {key: value or "" for key, value in row.items() if key is not None}
        for row in reader
    ]


def build_detected_features(
    findings: list[dict[str, str]],
) -> dict[str, bool]:
    features: dict[str, bool] = {}
    for finding in findings:
        gene_symbol = finding.get("Gene symbol", "").strip()
        if gene_symbol:
            features[f"gene:{gene_symbol}"] = True

        element_subtype = finding.get("Element subtype", "").strip()
        sequence_name = finding.get("Sequence name", "").strip()
        if element_subtype.startswith("POINT") and sequence_name:
            features[f"mutation:{sequence_name}"] = True
    return dict(sorted(features.items()))


def _remote_error_message(payload: dict[str, Any]) -> str:
    stderr = ANSI_ESCAPE.sub("", str(payload.get("stderr") or "")).strip()
    error = str(payload.get("error") or "").strip()

    if error:
        return error
    if stderr:
        lines = [line.strip() for line in stderr.splitlines() if line.strip()]
        for line in reversed(lines):
            if not line.startswith(("PATH:", "PWD:", "SHELL:", "HOSTNAME:")):
                return line[:500]
    return "The hosted AMRFinderPlus analysis failed."


class AmrFinderClient:
    def __init__(
        self,
        http_client: httpx.AsyncClient,
        *,
        base_url: str,
        protein_predictor: ProteinPredictor = predict_proteins_from_fasta,
    ) -> None:
        self._http = http_client
        self._base_url = base_url.rstrip("/")
        self._protein_predictor = protein_predictor

    async def status(self) -> AmrFinderStatusResponse:
        try:
            response = await self._http.get(f"{self._base_url}/healthz")
            response.raise_for_status()
            payload = response.json()
        except (
            httpx.HTTPError,
            TypeError,
            ValueError,
        ) as exc:
            return AmrFinderStatusResponse(
                configured=bool(self._base_url),
                reachable=False,
                protein_mode_ready=None,
                detail=f"Hosted service is unavailable: {exc}",
            )

        reachable = payload.get("status") == "ok"
        return AmrFinderStatusResponse(
            configured=True,
            reachable=reachable,
            protein_mode_ready=True if reachable else None,
            detail=(
                "Hosted protein analysis service is reachable."
                if reachable
                else "Hosted service returned an unexpected health response."
            ),
        )

    async def analyze(self, request: AmrFinderRequest) -> AmrFinderResponse:
        protein_fasta, protein_count = await asyncio.to_thread(
            self._protein_predictor,
            request.fasta,
        )
        payload: dict[str, Any] = {"fasta": protein_fasta}

        try:
            response = await self._http.post(
                f"{self._base_url}/api/amrfinderplus",
                json=payload,
            )
            response.raise_for_status()
            remote_payload = response.json()
        except httpx.TimeoutException as exc:
            raise AmrFinderError(
                "Hosted AMRFinderPlus analysis timed out."
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise AmrFinderError(
                f"Hosted AMRFinderPlus returned HTTP {exc.response.status_code}."
            ) from exc
        except (httpx.RequestError, ValueError, TypeError) as exc:
            raise AmrFinderError(
                "Unable to communicate with hosted AMRFinderPlus."
            ) from exc

        if not isinstance(remote_payload, dict):
            raise AmrFinderResponseError(
                "Hosted AMRFinderPlus returned an invalid response."
            )
        if not remote_payload.get("success"):
            raise AmrFinderResponseError(
                _remote_error_message(remote_payload)
            )

        output = str(remote_payload.get("output") or "")
        findings = parse_amrfinder_output(output)
        return AmrFinderResponse(
            organism=request.organism,
            predicted_protein_count=protein_count,
            finding_count=len(findings),
            findings=findings,
            detected_features=build_detected_features(findings),
            raw_output=output,
        )
