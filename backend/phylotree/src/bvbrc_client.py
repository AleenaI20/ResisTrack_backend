"""
Thin wrapper around the BV-BRC (bv-brc.org) public Data API.

The API is free and requires no key/authentication for public data
(see https://www.bv-brc.org/api/doc/). Queries use RQL syntax, e.g.:

    eq(field,value)
    and(eq(a,b), eq(c,d))
    select(field1,field2)
    limit(count,start)

This module only wraps the handful of endpoints this project needs:
  - genome_amr   : lab-measured antibiotic resistance phenotypes
  - genome       : genome metadata
  - genome_sequence : contig-level DNA sequence, retrievable as FASTA
"""

from __future__ import annotations
import requests
import time
from typing import Iterable

BASE_URL = "https://www.bv-brc.org/api"
TIMEOUT = 60
RETRIES = 3
RETRY_SLEEP_SEC = 5


def _get(path: str, rql_query: str, accept: str = "application/json") -> requests.Response:
    """
    GET a query against a BV-BRC data type.

    path: e.g. "genome_amr", "genome", "genome_sequence"
    rql_query: the query string portion, e.g. "eq(genus,Klebsiella)&limit(10)"
    accept: response content type (application/json, text/csv, application/dna+fasta, ...)
    """
    url = f"{BASE_URL}/{path}/?{rql_query}"
    headers = {"Accept": accept}

    last_err = None
    for attempt in range(1, RETRIES + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            last_err = e
            if attempt < RETRIES:
                time.sleep(RETRY_SLEEP_SEC)
    raise RuntimeError(f"BV-BRC request failed after {RETRIES} attempts: {url}\n{last_err}")


def query_genome_amr(genus_species: str, limit: int, offset: int = 0) -> list[dict]:
    """
    Pull lab-measured AMR phenotype records for a species.
    Only real laboratory typing methods are kept (not model-generated fields),
    per the challenge brief's instruction to use organizer-pinned laboratory results.
    """
    q = (
        f"eq(genome_name,{genus_species})"
        f"&select(genome_id,genome_name,antibiotic,resistant_phenotype,"
        f"laboratory_typing_method,testing_standard)"
        f"&limit({limit},{offset})"
    )
    resp = _get("genome_amr", q, accept="application/json")
    return resp.json()


def query_genome_metadata(genome_ids: Iterable[str]) -> list[dict]:
    """
    Pull minimal genome metadata for a list of genome IDs.
    Deliberately selects only the handful of fields this pipeline needs —
    BV-BRC genome records carry 70+ attributes, most irrelevant here.
    """
    ids_clause = ",".join(genome_ids)
    q = (
        f"in(genome_id,({ids_clause}))"
        f"&select(genome_id,genome_name,genome_length,contigs)"
        f"&limit({len(list(genome_ids))})"
    )
    resp = _get("genome", q, accept="application/json")
    return resp.json()


def fetch_genome_fasta(genome_id: str) -> str:
    """
    Retrieve the assembled contig DNA sequence for one genome as a FASTA string.
    """
    q = f"eq(genome_id,{genome_id})&limit(25000)"
    resp = _get("genome_sequence", q, accept="application/dna+fasta")
    return resp.text
