"""
CLI entry point for the Track B (phylogenetics) pipeline.

Usage:
    python -m src.pipeline --all
    python -m src.pipeline --download --sketch
    python -m src.pipeline --tree --clades
"""

from __future__ import annotations
import argparse

from src import (
    download_genomes, sketch_genomes, distance_matrix, build_tree, cut_clades,
    amr_annotate, parse_amr_matrix, join_tracks,
)


def main():
    parser = argparse.ArgumentParser(description="Genome Firewall pipeline")
    parser.add_argument("--config", default="config.yaml", help="Path to config.yaml")
    parser.add_argument("--all", action="store_true", help="Run all stages in order")
    parser.add_argument("--download", action="store_true", help="Stage 1: download genomes")
    parser.add_argument("--sketch", action="store_true", help="Stage 2: sketch genomes")
    parser.add_argument("--distance", action="store_true", help="Stage 3: build distance matrix")
    parser.add_argument("--tree", action="store_true", help="Stage 4: build NJ tree")
    parser.add_argument("--clades", action="store_true", help="Stage 5: cut into clades")
    parser.add_argument("--amr", action="store_true", help="Track A Stage 1: run AMRFinderPlus")
    parser.add_argument("--amr-matrix", action="store_true", help="Track A Stage 2: parse into gene matrix")
    parser.add_argument("--join", action="store_true", help="Join Track A + Track B into master table")
    args = parser.parse_args()

    any_flag = any([
        args.download, args.sketch, args.distance, args.tree, args.clades,
        args.amr, args.amr_matrix, args.join,
    ])
    run_all = args.all or not any_flag

    if run_all or args.download:
        print("\n=== Stage 1: Download genomes ===")
        download_genomes.main(args.config)

    if run_all or args.sketch:
        print("\n=== Stage 2: Sketch genomes ===")
        sketch_genomes.main(args.config)

    if run_all or args.distance:
        print("\n=== Stage 3: Build distance matrix ===")
        distance_matrix.main(args.config)

    if run_all or args.tree:
        print("\n=== Stage 4: Build NJ tree ===")
        build_tree.main(args.config)

    if run_all or args.clades:
        print("\n=== Stage 5: Cut into clades ===")
        cut_clades.main(args.config)

    # Track A (AMRFinderPlus) is NOT included in --all by default: it requires
    # a separate conda environment with the `amrfinder` binary on PATH (see
    # src/amr_annotate.py docstring), so it's opt-in via explicit flags rather
    # than assumed to be available in every environment running this repo.
    if args.amr:
        print("\n=== Track A Stage 1: Run AMRFinderPlus ===")
        amr_annotate.main(args.config)

    if args.amr_matrix:
        print("\n=== Track A Stage 2: Parse AMR results into gene matrix ===")
        parse_amr_matrix.main(args.config)

    if args.join:
        print("\n=== Join Track A + Track B ===")
        join_tracks.main(args.config)

    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
