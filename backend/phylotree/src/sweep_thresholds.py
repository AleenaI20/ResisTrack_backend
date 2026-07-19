"""
Sweep clustering distance thresholds and report the singleton-count vs.
largest-clade-size tradeoff at each one, so you can pick a threshold using
actual numbers instead of trial-and-error editing of config.yaml.

Does NOT touch config.yaml or overwrite outputs/clade_assignments.csv — it
only reads the existing distance matrix and prints a summary table. Once
you've picked a threshold, set it in config.yaml and run:
    python -m src.pipeline --clades

Usage:
    python -m src.sweep_thresholds
    python -m src.sweep_thresholds --thresholds 0.02 0.05 0.08 0.10 0.15 0.20
"""

from __future__ import annotations
import argparse
import yaml
import pandas as pd
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import squareform


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def summarize_threshold(Z, threshold: float, n_genomes: int) -> dict:
    clade_ids = fcluster(Z, t=threshold, criterion="distance")
    sizes = pd.Series(clade_ids).value_counts()

    n_clades = len(sizes)
    n_singletons = int((sizes == 1).sum())
    largest_clade = int(sizes.max())
    pct_in_singletons = round(100 * n_singletons / n_genomes, 1)

    return {
        "threshold": threshold,
        "n_clades": n_clades,
        "n_singletons": n_singletons,
        "pct_genomes_in_singletons": pct_in_singletons,
        "largest_clade_size": largest_clade,
    }


def main():
    parser = argparse.ArgumentParser(description="Sweep clustering thresholds")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument(
        "--thresholds",
        type=float,
        nargs="+",
        default=[0.01, 0.02, 0.03, 0.05, 0.08, 0.10, 0.15, 0.20, 0.30],
        help="Distance thresholds to test",
    )
    args = parser.parse_args()

    cfg = load_config(args.config)
    matrix_path = cfg["distance"]["matrix_file"]
    method = cfg["clustering"]["method"]

    print(f"Loading distance matrix from {matrix_path} ...")
    df = pd.read_csv(matrix_path, index_col=0, dtype=str)
    df = df.astype(float)
    n_genomes = len(df)

    condensed = squareform(df.values, checks=False)
    print(f"Running hierarchical clustering once (method={method}) ...")
    Z = linkage(condensed, method=method)

    print(f"\n{n_genomes} genomes total\n")
    rows = [summarize_threshold(Z, t, n_genomes) for t in args.thresholds]
    result = pd.DataFrame(rows)
    print(result.to_string(index=False))

    print(
        "\nGuideline: pick the smallest threshold where 'pct_genomes_in_singletons' "
        "drops to a level you're comfortable with, without 'largest_clade_size' "
        "ballooning to cover a large fraction of all genomes (that would mean "
        "clades are no longer meaningfully separating lineages)."
    )
    print("Then set clustering.distance_threshold in config.yaml and run:")
    print("    python -m src.pipeline --clades")


if __name__ == "__main__":
    main()
