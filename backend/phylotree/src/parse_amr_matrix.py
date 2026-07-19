"""
Track A, Stage 2 — Parse raw AMRFinderPlus output into Module 1's deliverable:
a genome x gene presence/absence matrix, plus a long-form detections table
that keeps the extra detail (element type, class, coverage, identity) needed
later for the "known gene vs. statistical association" evidence-tier split.

AMRFinderPlus column names have varied slightly across versions. This parser
looks for the gene-symbol and element-type columns under several known
aliases rather than assuming one exact header, so a version difference
doesn't silently break the whole pipeline.
"""

from __future__ import annotations
import os
import glob
import yaml
import pandas as pd
from tqdm import tqdm

# Known column-name aliases across AMRFinderPlus versions.
GENE_COL_ALIASES = ["Gene symbol", "Element symbol"]
TYPE_COL_ALIASES = ["Element type", "Type"]
SUBTYPE_COL_ALIASES = ["Element subtype", "Subtype"]
CLASS_COL_ALIASES = ["Class"]
SUBCLASS_COL_ALIASES = ["Subclass"]
COVERAGE_COL_ALIASES = ["% Coverage of reference sequence", "% Coverage of reference protein"]
IDENTITY_COL_ALIASES = ["% Identity to reference sequence", "% Identity to reference protein"]


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def _first_matching_column(df: pd.DataFrame, aliases: list[str]) -> str | None:
    for alias in aliases:
        if alias in df.columns:
            return alias
    return None


def parse_one_tsv(tsv_path: str) -> pd.DataFrame:
    """Return a long-form dataframe of detections for one genome, or an empty
    dataframe (with the right columns) if the genome had zero AMR hits."""
    genome_id = os.path.splitext(os.path.basename(tsv_path))[0]

    df = pd.read_csv(tsv_path, sep="\t")
    long_cols = ["genome_id", "gene_symbol", "element_type", "element_subtype",
                 "class", "subclass", "pct_coverage", "pct_identity"]

    if df.empty:
        return pd.DataFrame(columns=long_cols)

    gene_col = _first_matching_column(df, GENE_COL_ALIASES)
    if gene_col is None:
        print(f"  [warn] no recognizable gene-symbol column in {tsv_path}, skipping")
        return pd.DataFrame(columns=long_cols)

    type_col = _first_matching_column(df, TYPE_COL_ALIASES)
    subtype_col = _first_matching_column(df, SUBTYPE_COL_ALIASES)
    class_col = _first_matching_column(df, CLASS_COL_ALIASES)
    subclass_col = _first_matching_column(df, SUBCLASS_COL_ALIASES)
    coverage_col = _first_matching_column(df, COVERAGE_COL_ALIASES)
    identity_col = _first_matching_column(df, IDENTITY_COL_ALIASES)

    out = pd.DataFrame({
        "genome_id": genome_id,
        "gene_symbol": df[gene_col],
        "element_type": df[type_col] if type_col else None,
        "element_subtype": df[subtype_col] if subtype_col else None,
        "class": df[class_col] if class_col else None,
        "subclass": df[subclass_col] if subclass_col else None,
        "pct_coverage": df[coverage_col] if coverage_col else None,
        "pct_identity": df[identity_col] if identity_col else None,
    })
    return out.dropna(subset=["gene_symbol"])


def build_presence_absence_matrix(long_df: pd.DataFrame, all_genome_ids: list[str]) -> pd.DataFrame:
    """
    Wide genome_id x gene_symbol matrix, 1 = detected, 0 = not detected.
    Genomes with zero hits still appear as an all-zero row (important —
    "no detections" is a real, informative result, not a missing one).
    """
    if long_df.empty:
        return pd.DataFrame(index=all_genome_ids)

    wide = pd.crosstab(long_df["genome_id"], long_df["gene_symbol"])
    wide = (wide > 0).astype(int)
    wide = wide.reindex(all_genome_ids, fill_value=0)
    wide.index.name = "genome_id"
    return wide


def main(config_path: str = "config.yaml") -> None:
    cfg = load_config(config_path)
    raw_dir = cfg["amr"]["raw_results_dir"]
    matrix_path = cfg["amr"]["matrix_file"]
    detections_path = os.path.join(os.path.dirname(matrix_path), "amr_detections_long.csv")

    tsv_files = sorted(glob.glob(os.path.join(raw_dir, "*.tsv")))
    if not tsv_files:
        raise RuntimeError(f"No AMRFinderPlus .tsv files found in {raw_dir}. Run amr_annotate first.")

    all_genome_ids = [os.path.splitext(os.path.basename(p))[0] for p in tsv_files]

    print(f"Parsing {len(tsv_files)} AMRFinderPlus result files ...")
    long_frames = [parse_one_tsv(p) for p in tqdm(tsv_files, desc="Parsing")]
    long_df = pd.concat(long_frames, ignore_index=True) if long_frames else pd.DataFrame()

    os.makedirs(os.path.dirname(detections_path), exist_ok=True)
    long_df.to_csv(detections_path, index=False)
    print(f"Long-form detections saved -> {detections_path} ({len(long_df)} rows)")

    matrix = build_presence_absence_matrix(long_df, all_genome_ids)
    os.makedirs(os.path.dirname(matrix_path), exist_ok=True)
    matrix.to_csv(matrix_path)
    print(f"Presence/absence matrix saved -> {matrix_path} "
          f"({matrix.shape[0]} genomes x {matrix.shape[1]} genes)")


if __name__ == "__main__":
    main()
