"""
Track A, Stage 1 — Run AMRFinderPlus over every downloaded genome.

AMRFinderPlus is the brief's recommended default annotation tool. It is NOT
pip-installable — it's distributed via bioconda (a standard, free channel for
bioinformatics software). Install it once, in its own conda environment, before
running this script:

    conda create -y -c conda-forge -c bioconda -n amrfinder ncbi-amrfinderplus
    conda activate amrfinder
    amrfinder -U          # one-time database download (also free)

Then, from that same activated environment, run this script (it just shells
out to the `amrfinder` binary per genome — it does not need biopython/pandas
to be installed inside the amrfinder conda env, only Python's standard
library, so run it with whichever Python has `amrfinder` on its PATH).

This stage produces one raw AMRFinderPlus .tsv per genome. Parsing those into
a single presence/absence matrix is a separate stage (parse_amr_matrix.py) —
kept separate so a slow annotation run doesn't have to be redone just to
change how the matrix is built.
"""

from __future__ import annotations
import os
import subprocess
import shutil
import yaml
import glob
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm


def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def check_amrfinder_available() -> None:
    if shutil.which("amrfinder") is None:
        raise RuntimeError(
            "The `amrfinder` command was not found on your PATH.\n"
            "Install it (in its own conda env) with:\n"
            "  conda create -y -c conda-forge -c bioconda -n amrfinder ncbi-amrfinderplus\n"
            "  conda activate amrfinder\n"
            "  amrfinder -U\n"
            "Then re-run this script from that activated environment."
        )


def run_amrfinder_on_genome(
    fasta_path: str, out_path: str, organism: str, plus: bool, threads: int
) -> tuple[str, bool, str]:
    cmd = [
        "amrfinder",
        "--nucleotide", fasta_path,
        "--organism", organism,
        "--output", out_path,
        "--threads", str(threads),
    ]
    if plus:
        cmd.append("--plus")

    result = subprocess.run(cmd, capture_output=True, text=True)
    ok = result.returncode == 0
    return (fasta_path, ok, result.stderr.strip()[:500] if not ok else "")


def main(config_path: str = "config.yaml") -> None:
    check_amrfinder_available()
    cfg = load_config(config_path)

    fasta_dir = os.path.join(cfg["download"]["raw_dir"], cfg["download"]["fasta_subdir"])
    out_dir = cfg["amr"]["raw_results_dir"]
    organism = cfg["amr"]["organism"]
    plus = cfg["amr"]["plus"]
    threads_per_job = cfg["amr"].get("threads_per_job", 1)
    parallel_workers = cfg["amr"].get("parallel_workers", 4)

    os.makedirs(out_dir, exist_ok=True)

    fasta_files = sorted(glob.glob(os.path.join(fasta_dir, "*.fasta")))
    if not fasta_files:
        raise RuntimeError(f"No FASTA files found in {fasta_dir}. Run download_genomes first.")

    # Skip genomes already annotated, so re-running after a partial/interrupted
    # run only processes what's left.
    pending = []
    for fasta_path in fasta_files:
        genome_id = os.path.splitext(os.path.basename(fasta_path))[0]
        out_path = os.path.join(out_dir, f"{genome_id}.tsv")
        if not os.path.exists(out_path):
            pending.append((fasta_path, out_path))

    already_done = len(fasta_files) - len(pending)
    print(f"{already_done} genomes already annotated, {len(pending)} remaining.")
    print(f"Running AMRFinderPlus (organism={organism}, plus={plus}) "
          f"with {parallel_workers} parallel workers x {threads_per_job} thread(s) each ...")

    if not pending:
        print("Nothing to do.")
        return

    failures = []
    with ThreadPoolExecutor(max_workers=parallel_workers) as pool:
        futures = {
            pool.submit(run_amrfinder_on_genome, fasta_path, out_path, organism, plus, threads_per_job): fasta_path
            for fasta_path, out_path in pending
        }
        for future in tqdm(as_completed(futures), total=len(futures), desc="AMRFinderPlus"):
            fasta_path, ok, err = future.result()
            if not ok:
                failures.append((fasta_path, err))

    if failures:
        print(f"\n[warn] {len(failures)} genomes failed:")
        for fasta_path, err in failures[:10]:
            print(f"  {fasta_path}: {err}")

    print(f"Raw AMRFinderPlus results written to {out_dir}")


if __name__ == "__main__":
    main()
