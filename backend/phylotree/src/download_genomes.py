"""
Stage 1 — Download genomes.

Pulls Klebsiella pneumoniae genomes that have real, lab-measured AMR phenotype
records from BV-BRC, then downloads the assembled contig FASTA for each one.

Only lab-measured (not model-predicted) phenotype records are used, and only a
small set of metadata fields are kept — see README "Data hygiene" section.
"""

from __future__ import annotations
import os
import yaml
import pandas as pd
from tqdm import tqdm

from src.bvbrc_client import query_genome_amr, query_genome_metadata, fetch_genome_fasta


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def pull_amr_labels(cfg: dict) -> pd.DataFrame:
    """Pull lab-measured AMR phenotype rows and keep only genomes with a real typing method."""
    species = cfg["organism"]["genus_species"]
    max_genomes = cfg["download"]["max_genomes"]

    # Over-fetch rows since one genome can have multiple antibiotic rows;
    # we'll de-duplicate down to `max_genomes` unique genome_ids afterward.
    records = query_genome_amr(species, limit=max_genomes * 10)
    df = pd.DataFrame.from_records(records)

    if df.empty:
        raise RuntimeError(
            "No genome_amr records returned. Check organism name / API availability."
        )

    # Keep only rows with a documented laboratory typing method (real lab result,
    # not a model-generated / inferred phenotype field).
    df = df[df["laboratory_typing_method"].notna() & (df["laboratory_typing_method"] != "")]

    unique_ids = df["genome_id"].drop_duplicates().head(max_genomes).tolist()
    df = df[df["genome_id"].isin(unique_ids)].reset_index(drop=True)
    return df


def pull_genome_metadata(genome_ids: list[str]) -> pd.DataFrame:
    """Pull minimal, clean genome metadata for the selected genome IDs."""
    records = query_genome_metadata(genome_ids)
    df = pd.DataFrame.from_records(records)
    # Keep only what downstream stages actually use.
    keep_cols = ["genome_id", "genome_name", "genome_length", "contigs"]
    return df[[c for c in keep_cols if c in df.columns]]


def download_fasta_files(genome_ids: list[str], fasta_dir: str) -> None:
    os.makedirs(fasta_dir, exist_ok=True)
    for genome_id in tqdm(genome_ids, desc="Downloading FASTA"):
        out_path = os.path.join(fasta_dir, f"{genome_id}.fasta")
        if os.path.exists(out_path):
            continue  # already downloaded, skip (safe to re-run pipeline)
        fasta_text = fetch_genome_fasta(genome_id)
        if not fasta_text.strip():
            print(f"  [warn] empty FASTA for genome_id={genome_id}, skipping")
            continue
        with open(out_path, "w") as f:
            f.write(fasta_text)


def main(config_path: str = "config.yaml") -> None:
    cfg = load_config(config_path)
    raw_dir = cfg["download"]["raw_dir"]
    os.makedirs(raw_dir, exist_ok=True)

    print("Pulling lab-measured AMR label records from BV-BRC ...")
    labels_df = pull_amr_labels(cfg)
    labels_path = os.path.join(raw_dir, cfg["download"]["labels_file"])
    labels_df.to_csv(labels_path, index=False)
    print(f"  saved {len(labels_df)} label rows -> {labels_path}")

    genome_ids = labels_df["genome_id"].unique().tolist()
    print(f"Selected {len(genome_ids)} unique genomes")

    print("Pulling minimal genome metadata ...")
    meta_df = pull_genome_metadata(genome_ids)
    meta_path = os.path.join(raw_dir, cfg["download"]["metadata_file"])
    meta_df.to_csv(meta_path, index=False)
    print(f"  saved metadata -> {meta_path}")

    fasta_dir = os.path.join(raw_dir, cfg["download"]["fasta_subdir"])
    print(f"Downloading FASTA files to {fasta_dir} ...")
    download_fasta_files(genome_ids, fasta_dir)
    print("Done.")


if __name__ == "__main__":
    main()
