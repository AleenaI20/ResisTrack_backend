"""
Stage 3 — Build the pairwise distance matrix.

Loads every genome's MinHash signature and computes an all-vs-all genetic
distance matrix using Jaccard similarity between sketches (the same quantity
`mash dist` reports, just via sourmash's Python API instead of the mash
binary).

distance = 1 - jaccard_similarity

Output: a genome_id x genome_id CSV, symmetric, 0 on the diagonal.
"""

from __future__ import annotations
import os
import glob
import yaml
import pandas as pd
from tqdm import tqdm
import sourmash


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def load_signatures(sig_dir: str) -> dict[str, sourmash.MinHash]:
    sig_files = sorted(glob.glob(os.path.join(sig_dir, "*.sig")))
    if not sig_files:
        raise RuntimeError(f"No signatures found in {sig_dir}. Run sketch_genomes first.")

    signatures = {}
    for path in sig_files:
        genome_id = os.path.splitext(os.path.basename(path))[0]
        loaded = list(sourmash.load_file_as_signatures(path))
        if not loaded:
            print(f"  [warn] empty signature file: {path}")
            continue
        signatures[genome_id] = loaded[0].minhash
    return signatures


def build_distance_matrix(signatures: dict[str, sourmash.MinHash]) -> pd.DataFrame:
    genome_ids = list(signatures.keys())
    n = len(genome_ids)
    matrix = pd.DataFrame(0.0, index=genome_ids, columns=genome_ids)

    for i in tqdm(range(n), desc="Computing distances"):
        for j in range(i + 1, n):
            id_i, id_j = genome_ids[i], genome_ids[j]
            similarity = signatures[id_i].jaccard(signatures[id_j])
            distance = 1.0 - similarity
            matrix.loc[id_i, id_j] = distance
            matrix.loc[id_j, id_i] = distance

    return matrix


def main(config_path: str = "config.yaml") -> None:
    cfg = load_config(config_path)
    sig_dir = cfg["sketch"]["signatures_dir"]
    out_path = cfg["distance"]["matrix_file"]

    print(f"Loading signatures from {sig_dir} ...")
    signatures = load_signatures(sig_dir)
    print(f"Loaded {len(signatures)} genome signatures")

    matrix = build_distance_matrix(signatures)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    matrix.to_csv(out_path)
    print(f"Distance matrix ({matrix.shape[0]}x{matrix.shape[1]}) saved -> {out_path}")


if __name__ == "__main__":
    main()
