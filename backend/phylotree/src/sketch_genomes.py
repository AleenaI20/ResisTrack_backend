"""
Stage 2 — Sketch genomes.

Computes a MinHash sketch (via sourmash) for every downloaded genome. This is
the free, pip-installable, pure-Python-friendly stand-in for `mash sketch` —
same idea: summarize a genome's k-mer content into a small, fast-to-compare
fingerprint, without doing a full sequence alignment.

Sketching is done on WHOLE-GENOME sequence only. No AMR gene information is
used here — that separation is what keeps the phylogenetics track an
independent line of evidence from the AMR-annotation track.
"""

from __future__ import annotations
import os
import glob
import yaml
from tqdm import tqdm
from Bio import SeqIO
import sourmash


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def sketch_one_genome(fasta_path: str, ksize: int, scaled: int) -> sourmash.SourmashSignature:
    genome_id = os.path.splitext(os.path.basename(fasta_path))[0]
    mh = sourmash.MinHash(n=0, ksize=ksize, scaled=scaled)

    for record in SeqIO.parse(fasta_path, "fasta"):
        mh.add_sequence(str(record.seq).upper(), force=True)

    return sourmash.SourmashSignature(mh, name=genome_id)


def main(config_path: str = "config.yaml") -> None:
    cfg = load_config(config_path)
    fasta_dir = os.path.join(cfg["download"]["raw_dir"], cfg["download"]["fasta_subdir"])
    sig_dir = cfg["sketch"]["signatures_dir"]
    os.makedirs(sig_dir, exist_ok=True)

    ksize = cfg["sketch"]["kmer_size"]
    scaled = cfg["sketch"]["scaled"]

    fasta_files = sorted(glob.glob(os.path.join(fasta_dir, "*.fasta")))
    if not fasta_files:
        raise RuntimeError(f"No FASTA files found in {fasta_dir}. Run download_genomes first.")

    print(f"Sketching {len(fasta_files)} genomes (k={ksize}, scaled={scaled}) ...")
    for fasta_path in tqdm(fasta_files, desc="Sketching"):
        genome_id = os.path.splitext(os.path.basename(fasta_path))[0]
        out_path = os.path.join(sig_dir, f"{genome_id}.sig")
        if os.path.exists(out_path):
            continue  # safe to re-run

        sig = sketch_one_genome(fasta_path, ksize, scaled)
        with open(out_path, "w") as f:
            sourmash.save_signatures([sig], fp=f)

    print(f"Signatures written to {sig_dir}")


if __name__ == "__main__":
    main()
