"""
Join Track A (AMR gene presence/absence) and Track B (clade assignment) into
one master feature table, keyed on genome_id.

This is the step where the two independently-computed evidence tracks meet
for the first time. They must have been computed separately — the AMR matrix
from AMRFinderPlus, the clade IDs from whole-genome k-mer distance — for the
"known gene vs. lineage-based circumstantial evidence" split to mean anything
downstream.
"""

from __future__ import annotations
import os
import yaml
import pandas as pd


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def main(config_path: str = "config.yaml") -> None:
    cfg = load_config(config_path)
    amr_matrix_path = cfg["amr"]["matrix_file"]
    clade_path = cfg["clustering"]["output_file"]
    out_path = cfg["join"]["master_table_file"]

    print(f"Loading AMR gene matrix from {amr_matrix_path} ...")
    amr_df = pd.read_csv(amr_matrix_path, dtype={"genome_id": str})
    amr_df["genome_id"] = amr_df["genome_id"].astype(str)

    print(f"Loading clade assignments from {clade_path} ...")
    clade_df = pd.read_csv(clade_path, dtype={"genome_id": str})
    clade_df["genome_id"] = clade_df["genome_id"].astype(str)

    merged = clade_df.merge(amr_df, on="genome_id", how="outer", indicator=True)

    only_clade = (merged["_merge"] == "left_only").sum()
    only_amr = (merged["_merge"] == "right_only").sum()
    if only_clade:
        print(f"  [warn] {only_clade} genomes have a clade but no AMR result — check amr_annotate ran on all genomes")
    if only_amr:
        print(f"  [warn] {only_amr} genomes have an AMR result but no clade — check the phylogenetics pipeline ran on all genomes")

    merged = merged.drop(columns=["_merge"])

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    merged.to_csv(out_path, index=False)
    print(f"Master feature table saved -> {out_path} "
          f"({merged.shape[0]} genomes x {merged.shape[1]} columns)")


if __name__ == "__main__":
    main()
