"""
Stage 4 — Build the neighbor-joining tree.

Takes the pairwise distance matrix and builds a neighbor-joining tree using
Biopython (pure Python, no external tree-building binary required). Writes
the tree in Newick format plus a quick PNG for visual sanity-checking.
"""

from __future__ import annotations
import os
import yaml
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # no display needed / available in this environment
import matplotlib.pyplot as plt

from Bio.Phylo.TreeConstruction import DistanceMatrix, DistanceTreeConstructor
from Bio import Phylo


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def to_biopython_distance_matrix(df: pd.DataFrame) -> DistanceMatrix:
    """
    Biopython expects a lower-triangular distance matrix as a list of lists,
    e.g. for names [A, B, C]:
        [ [0],
          [d(B,A), 0],
          [d(C,A), d(C,B), 0] ]
    """
    names = list(df.index)
    lower_triangle = []
    for i, name_i in enumerate(names):
        row = [float(df.loc[name_i, names[j]]) for j in range(i + 1)]
        lower_triangle.append(row)
    return DistanceMatrix(names=names, matrix=lower_triangle)


def build_nj_tree(distance_matrix: DistanceMatrix):
    constructor = DistanceTreeConstructor()
    return constructor.nj(distance_matrix)


def main(config_path: str = "config.yaml") -> None:
    cfg = load_config(config_path)
    matrix_path = cfg["distance"]["matrix_file"]
    newick_path = cfg["tree"]["newick_file"]
    png_path = cfg["tree"]["png_file"]

    print(f"Loading distance matrix from {matrix_path} ...")
    # dtype=str keeps genome IDs like "72407.144" as exact text on read —
    # pandas otherwise infers them as float64 and can lose precision on the
    # round trip, which breaks index/column name matching later. Values are
    # cast to float immediately after, since the matrix itself is numeric.
    df = pd.read_csv(matrix_path, index_col=0, dtype=str)
    df = df.astype(float)

    print("Converting to Biopython distance matrix format ...")
    bio_matrix = to_biopython_distance_matrix(df)

    print("Building neighbor-joining tree ...")
    tree = build_nj_tree(bio_matrix)
    tree.root_at_midpoint()

    os.makedirs(os.path.dirname(newick_path), exist_ok=True)
    Phylo.write(tree, newick_path, "newick")
    print(f"Tree written -> {newick_path}")

    fig = plt.figure(figsize=(10, max(6, len(df) * 0.15)))
    ax = fig.add_subplot(1, 1, 1)
    Phylo.draw(tree, axes=ax, do_show=False)
    fig.savefig(png_path, dpi=150, bbox_inches="tight")
    print(f"Tree image written -> {png_path}")


if __name__ == "__main__":
    main()
