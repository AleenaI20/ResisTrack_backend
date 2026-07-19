# ResisTrack

**An AI defense system against superbugs — predicting antibiotic resistance from a bacterial genome, before the lab results arrive.**

Built for the Hack-Nation Genome Firewall challenge (6th Global AI Hackathon, in collaboration with MIT Club of Northern California and MIT Club of Germany, powered by OpenAI).

---

## The problem

Antibiotic-resistant infections are linked to more than 4.7 million deaths every year. Standard lab testing to find out which antibiotic will actually work takes 1–3 days — during that window, doctors treat on their best guess, and every wrong guess costs time and helps resistant bacteria spread further.

Much of the answer is already sitting inside the bacterium's own DNA. **ResisTrack** turns a sequenced, assembled bacterial genome into an early, evidence-backed prediction of which antibiotics are likely to work — days before culture-based lab results are ready.

This is strictly a **defensive, decision-support tool**. It never designs, modifies, or suggests changes to an organism, and every result must be confirmed by standard laboratory testing.

## Why this approach is different

Most genome-to-resistance tools stop at one question: *does this genome carry a known resistance gene?*

ResisTrack asks a second question most tools skip: *what bacterial lineage does this genome belong to, and does that lineage have a history of resistance?*

Acquired antibiotic resistance — especially in organisms like carbapenem-resistant *Klebsiella pneumoniae* — spreads largely through a handful of globally dominant clones trading resistance plasmids. A gene-only model misses the circumstantial evidence sitting in a genome's ancestry. ResisTrack keeps these two lines of evidence **independent** and then combines them, so every prediction can honestly report which kind of evidence it's based on:

1. **Direct evidence** — a known resistance gene or mutation was detected
2. **Circumstantial evidence** — no confirmed gene, but the genome belongs to a lineage historically associated with resistance
3. **Statistical association only** — a feature correlated with resistance in training data, with no clear biological explanation
4. **No signal** → the system honestly returns **no-call** rather than forcing a guess

## Organism in focus

**Klebsiella pneumoniae** — a WHO critical-priority pathogen, and the textbook case for acquired (plasmid-driven) carbapenem resistance spreading through high-risk clonal lineages (e.g. ST258, ST11, ST307).

## Architecture

```
                         ASSEMBLED BACTERIAL GENOMES (FASTA)
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                          │
                    ▼                                          ▼
         TRACK A: AMR ANNOTATION                    TRACK B: PHYLOGENETICS
                    │                                          │
          AMRFinderPlus (NCBI)                        MinHash genome sketching
          --organism Klebsiella_pneumoniae            (sourmash)
                    │                                          │
          gene / mutation calls                       all-vs-all genetic
                    │                                  distance matrix
                    ▼                                          │
        presence/absence matrix                                ▼
        (genome × AMR gene)                       neighbor-joining tree
                    │                              + discrete clade IDs
                    │                                          │
                    └────────────────┬─────────────────────────┘
                                     ▼
                         MASTER FEATURE TABLE
                    (genome_id, clade_id, AMR gene columns)
                                     │
                                     ▼
                    GROUPED TRAIN / CALIBRATION / TEST SPLIT
                       (held out by clade — never by genome)
                                     │
                                     ▼
                     PER-ANTIBIOTIC PREDICTOR  *(in progress)*
                  likely to work / likely to fail / no-call
                     + calibrated confidence + evidence tier
                                     │
                                     ▼
                  STREAMLIT DECISION-REPORT DEMO  *(in progress)*
```

The two tracks are computed **independently** — Track B's clades come from whole-genome k-mer content, never from AMR genes — so that "lineage-based evidence" and "gene-based evidence" remain genuinely separate signals rather than the same information restated twice.

## Project status

| Module | Status |
|---|---|
| Track B — Phylogenetics (genome sketching, distance matrix, tree, clade assignment) | ✅ Done |
| Track A — AMR annotation (AMRFinderPlus integration, gene/mutation parsing) | ✅ Done |
| Join — master feature table (Track A + Track B) | ✅ Done |
| Grouped train/calibration/test split by clade | 🔜 In progress |
| Per-antibiotic predictor + calibration | 🔜 In progress |
| Streamlit decision-report demo | 🔜 In progress |

## Repo structure

```
ResisTrack/
├── README.md
├── requirements.txt
├── config.yaml                    ← all tunable parameters
├── src/
│   ├── bvbrc_client.py            ← BV-BRC public REST API wrapper
│   ├── download_genomes.py        ← pull genomes + lab-measured AMR labels
│   ├── sketch_genomes.py          ← MinHash genome sketching (sourmash)
│   ├── distance_matrix.py         ← all-vs-all genetic distance
│   ├── build_tree.py              ← neighbor-joining phylogenetic tree
│   ├── cut_clades.py              ← distance matrix → discrete clade IDs
│   ├── sweep_thresholds.py        ← tune the clade-cutting threshold
│   ├── amr_annotate.py            ← run AMRFinderPlus per genome
│   ├── parse_amr_matrix.py        ← AMRFinderPlus output → gene matrix
│   ├── join_tracks.py             ← merge Track A + Track B
│   └── pipeline.py                ← CLI entry point for all stages
├── data/                          ← downloaded genomes, sketches (gitignored, regenerable)
└── outputs/                       ← tree, clade assignments, gene matrix, master table
```

## Data & tools — all free, all open

| Purpose | Tool | Notes |
|---|---|---|
| Genome + resistance data | [BV-BRC](https://www.bv-brc.org) | Free public REST API, no key required |
| AMR gene/mutation detection | [AMRFinderPlus](https://github.com/ncbi/amr) | NCBI, public domain; installed via bioconda |
| Genome sketching | [sourmash](https://sourmash.readthedocs.io) | pip-installable MinHash implementation |
| Tree construction | [Biopython](https://biopython.org) | Pure-Python neighbor-joining |
| Clustering | [scipy](https://scipy.org) | Hierarchical clustering on the distance matrix |

## Setup

```bash
git clone https://github.com/AleenaI20/ResisTrack_backend.git
cd ResisTrack_backend

python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

AMRFinderPlus needs a separate conda environment (it isn't pip-installable):

```bash
conda create -y -c conda-forge -c bioconda -n amrfinder ncbi-amrfinderplus
conda activate amrfinder
amrfinder -U        # one-time database download
```

## Usage

Run the phylogenetics pipeline (Track B):

```bash
python -m src.pipeline --download --sketch --distance --tree --clades
```

Tune the clade-cutting threshold before locking it in:

```bash
python -m src.sweep_thresholds
```

Run AMR annotation (Track A) — from the activated `amrfinder` conda environment:

```bash
python -m src.pipeline --amr
```

Parse results and join both tracks into the master feature table:

```bash
python -m src.pipeline --amr-matrix --join
```

Or run everything with sensible defaults:

```bash
python -m src.pipeline --all
```

## Responsibility & safety

This is a biosecurity-relevant research prototype, built to the following principles:

- **Defensive by construction** — predicts and explains resistance that already exists; never generates, designs, or modifies an organism.
- **Honest generalization** — genomes are split into train/test by genetic lineage (clade), not at random, so results reflect real generalization rather than memorized near-duplicates.
- **Calibrated confidence with a no-call option** — a confident wrong answer is worse than an honest "uncertain."
- **Honest explanations** — a directly-detected resistance gene is reported separately from a merely statistical association; neither is confused with proof of biological cause.
- **Human oversight** — every result is decision support only, always paired with a reminder to confirm with standard laboratory testing. This tool never makes a treatment decision on its own.

This is a research prototype. Predictions based on historical genome data do not prove the system is safe, accurate enough, or suitable for real clinical decisions.

## Acknowledgments

Built for the **Genome Firewall** challenge — Hack-Nation's 6th Global AI Hackathon, in collaboration with the MIT Club of Northern California and MIT Club of Germany, powered by OpenAI.
