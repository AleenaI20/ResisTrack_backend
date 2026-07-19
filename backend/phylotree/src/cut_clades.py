"""
Stage 5 — Cut into discrete clades.

Converts the continuous distance matrix into discrete clade labels via
hierarchical clustering. This is the "cut the tree at a threshold" step —
done directly on the distance matrix with scipy for reproducibility, rather
than by eye on the tree image.

The cut threshold (config.yaml -> clustering.distance_threshold) is a
judgment call: too coarse and every genome becomes one clade (useless);
too fine and every genome is its own clade (equally useless — defeats the
purpose of grouping for train/test splitting). Document whatever threshold
you settle on and why, in your write-up.

Output: genome_id, clade_id (final Track B deliverable).
"""

from __future__ import annotations
import os
import yaml
import pandas as pd
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import squareform


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def main(config_path: str = "config.yaml") -> None:
    cfg = load_config(config_path)
    matrix_path = cfg["distance"]["matrix_file"]
    method = cfg["clustering"]["method"]
    threshold = cfg["clustering"]["distance_threshold"]
    out_path = cfg["clustering"]["output_file"]

    print(f"Loading distance matrix from {matrix_path} ...")
    # dtype=str avoids the same float-precision round-trip issue described
    # in build_tree.py — genome IDs like "72407.144" look numeric to pandas.
    df = pd.read_csv(matrix_path, index_col=0, dtype=str)
    df = df.astype(float)
    genome_ids = list(df.index)

    # scipy wants a condensed distance matrix (upper triangle, no diagonal)
    condensed = squareform(df.values, checks=False)

    print(f"Running hierarchical clustering (method={method}) ...")
    Z = linkage(condensed, method=method)

    clade_ids = fcluster(Z, t=threshold, criterion="distance")

    result = pd.DataFrame({"genome_id": genome_ids, "clade_id": clade_ids})
    result = result.sort_values(["clade_id", "genome_id"]).reset_index(drop=True)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    result.to_csv(out_path, index=False)

    n_clades = result["clade_id"].nunique()
    print(f"{len(result)} genomes assigned to {n_clades} clades at threshold={threshold}")
    print(f"Clade assignments saved -> {out_path}")

    clade_sizes = result["clade_id"].value_counts().sort_index()
    print("\nClade size distribution:")
    print(clade_sizes.to_string())


if __name__ == "__main__":
    main()
