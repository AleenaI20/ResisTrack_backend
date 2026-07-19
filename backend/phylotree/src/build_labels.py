"""
Build the final labeled feature table for the Predictor.

Takes the long-form AMR label records pulled in Stage 1 (data/raw/amr_labels.csv),
filters them down to genuine laboratory-measured results, pivots to one column
per antibiotic, and joins the result onto the existing master feature table
(genome_id, clade_id, AMR gene columns).

Filtering decisions, applied in this order:
  1. Drop rows whose laboratory_typing_method is "Computational Prediction" —
     the brief explicitly requires organizer-pinned LAB-measured results, not
     model-generated phenotype fields. This was silently slipping through
     download_genomes.py's original filter (which only checked "non-empty",
     not "is an actual lab method").
  2. Drop rows with a blank/missing resistant_phenotype — nothing to learn from.
  3. Drop rows labeled "Intermediate" — treated as genuinely ambiguous ground
     truth rather than forced into Resistant or Susceptible. This keeps the
     "honest, no forced answers" principle consistent from labels through to
     the model's own no-call behavior.
  4. Restrict to a fixed set of antibiotics that actually have enough real
     lab-confirmed genomes to model (see config.yaml -> labels.antibiotics).

Output is intentionally NOT one-hot/dense for antibiotics a genome was never
tested against — those cells are left as NaN (missing), not 0, since "never
tested" and "tested susceptible" are different facts and must not be conflated.
"""

from __future__ import annotations
import os
import yaml
import pandas as pd


NON_LAB_METHODS = {"Computational Prediction"}
PHENOTYPE_MAP = {"Resistant": 1, "Susceptible": 0}  # Intermediate is dropped, not mapped


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def filter_labels(df: pd.DataFrame, antibiotics: list[str]) -> pd.DataFrame:
    before = len(df)

    df = df[~df["laboratory_typing_method"].isin(NON_LAB_METHODS)]
    after_method_filter = len(df)

    df = df[df["resistant_phenotype"].notna() & (df["resistant_phenotype"] != "")]
    after_blank_filter = len(df)

    df = df[df["resistant_phenotype"] != "Intermediate"]
    after_intermediate_filter = len(df)

    df = df[df["antibiotic"].isin(antibiotics)]
    after_antibiotic_filter = len(df)

    print(f"  {before} raw rows")
    print(f"  -> {after_method_filter} after excluding non-lab typing methods "
          f"({before - after_method_filter} dropped)")
    print(f"  -> {after_blank_filter} after dropping blank phenotypes "
          f"({after_method_filter - after_blank_filter} dropped)")
    print(f"  -> {after_intermediate_filter} after dropping Intermediate "
          f"({after_blank_filter - after_intermediate_filter} dropped)")
    print(f"  -> {after_antibiotic_filter} after restricting to selected antibiotics "
          f"({after_intermediate_filter - after_antibiotic_filter} dropped)")

    return df


def pivot_to_wide(df: pd.DataFrame) -> pd.DataFrame:
    """
    One row per genome_id, one column per antibiotic, value = 1 (resistant),
    0 (susceptible), or NaN (never tested against this drug).

    If a genome has more than one row for the same antibiotic (re-tested,
    duplicate records), the rows must agree — a genuine conflict is a data
    quality problem worth surfacing, not silently averaging away.
    """
    df = df.copy()
    df["label"] = df["resistant_phenotype"].map(PHENOTYPE_MAP)

    grouped = df.groupby(["genome_id", "antibiotic"])["label"].agg(["nunique", "first"])
    conflicts = grouped[grouped["nunique"] > 1]
    if not conflicts.empty:
        print(f"  [warn] {len(conflicts)} genome/antibiotic pairs have conflicting "
              f"labels across duplicate rows — keeping the first occurrence for each.")

    wide = df.drop_duplicates(subset=["genome_id", "antibiotic"], keep="first")
    wide = wide.pivot(index="genome_id", columns="antibiotic", values="label")
    wide.columns.name = None
    return wide


def report_clade_coverage(labels_wide: pd.DataFrame, clade_path: str) -> None:
    """
    Diagnostic only: for each antibiotic, how many labeled genomes fall into
    the largest clades vs. singleton clades. A grouped train/test split needs
    labeled genomes concentrated in clades big enough to both train on some
    members and hold out others.
    """
    clades = pd.read_csv(clade_path, dtype={"genome_id": str})
    clades["genome_id"] = clades["genome_id"].astype(str)
    clade_sizes = clades["clade_id"].value_counts()

    merged = labels_wide.reset_index().merge(clades, on="genome_id", how="left")
    merged["clade_size"] = merged["clade_id"].map(clade_sizes)

    print("\nClade coverage per antibiotic (labeled genomes only):")
    for antibiotic in labels_wide.columns:
        labeled = merged[merged[antibiotic].notna()]
        in_large_clade = (labeled["clade_size"] >= 3).sum()
        singleton = (labeled["clade_size"] == 1).sum()
        print(f"  {antibiotic}: {len(labeled)} labeled genomes total, "
              f"{in_large_clade} in a clade of size>=3, {singleton} in singleton clades")


def main(config_path: str = "config.yaml") -> None:
    cfg = load_config(config_path)
    labels_path = os.path.join(cfg["download"]["raw_dir"], cfg["download"]["labels_file"])
    master_path = cfg["join"]["master_table_file"]
    clade_path = cfg["clustering"]["output_file"]
    antibiotics = cfg["labels"]["antibiotics"]
    out_path = cfg["labels"]["output_file"]

    print(f"Loading raw AMR labels from {labels_path} ...")
    raw = pd.read_csv(labels_path, dtype={"genome_id": str})
    raw["genome_id"] = raw["genome_id"].astype(str)

    print("Filtering to genuine lab-measured, non-ambiguous, in-scope labels ...")
    filtered = filter_labels(raw, antibiotics)

    print("\nPivoting to wide format (genome_id x antibiotic) ...")
    labels_wide = pivot_to_wide(filtered)
    print(f"  {labels_wide.shape[0]} genomes with at least one label, "
          f"{labels_wide.shape[1]} antibiotic columns")

    report_clade_coverage(labels_wide, clade_path)

    print(f"\nLoading master feature table from {master_path} ...")
    master = pd.read_csv(master_path, dtype={"genome_id": str})
    master["genome_id"] = master["genome_id"].astype(str)

    final = master.merge(labels_wide.reset_index(), on="genome_id", how="left")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    final.to_csv(out_path, index=False)
    print(f"\nLabeled feature table saved -> {out_path} "
          f"({final.shape[0]} genomes x {final.shape[1]} columns)")

    present_antibiotics = [a for a in antibiotics if a in final.columns]
    missing_antibiotics = [a for a in antibiotics if a not in final.columns]
    if missing_antibiotics:
        print(f"  [warn] these configured antibiotics had ZERO usable labeled rows "
              f"after filtering and got no column at all: {missing_antibiotics}")

    if present_antibiotics:
        n_with_any_label = final[present_antibiotics].notna().any(axis=1).sum()
        print(f"{n_with_any_label} of {final.shape[0]} genomes have at least one usable label; "
              f"the rest have features but no label for any selected antibiotic and are "
              f"unusable for training (fine to keep in the file for reference).")
    else:
        print("  [warn] none of the configured antibiotics produced any usable labels at all.")


if __name__ == "__main__":
    main()
