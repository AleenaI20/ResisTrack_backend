"""
CLI entry point for the Track B (phylogenetics) pipeline.

Usage:
    python -m src.pipeline --all
    python -m src.pipeline --download --sketch
    python -m src.pipeline --tree --clades
"""

from __future__ import annotations
import argparse

from src import download_genomes, sketch_genomes, distance_matrix, build_tree, cut_clades


def main():
    parser = argparse.ArgumentParser(description="Genome Firewall — Track B pipeline")
    parser.add_argument("--config", default="config.yaml", help="Path to config.yaml")
    parser.add_argument("--all", action="store_true", help="Run all stages in order")
    parser.add_argument("--download", action="store_true", help="Stage 1: download genomes")
    parser.add_argument("--sketch", action="store_true", help="Stage 2: sketch genomes")
    parser.add_argument("--distance", action="store_true", help="Stage 3: build distance matrix")
    parser.add_argument("--tree", action="store_true", help="Stage 4: build NJ tree")
    parser.add_argument("--clades", action="store_true", help="Stage 5: cut into clades")
    args = parser.parse_args()

    run_all = args.all or not any(
        [args.download, args.sketch, args.distance, args.tree, args.clades]
    )

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

    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
