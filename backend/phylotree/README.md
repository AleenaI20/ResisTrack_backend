# Genome Firewall — Phylogenetics Track (Track B)

Part of a submission to the Hack-Nation "Genome Firewall" challenge (6th Global AI
Hackathon, in collaboration with MIT Club of Northern California / MIT Club of
Germany, powered by OpenAI).

This repo builds the **phylogenetics layer**: given a set of assembled bacterial
genomes, it groups them into evolutionary lineages ("clades") independently of any
resistance-gene information. Those clade labels are later used (in the Predictor
module, not in this repo) as:

1. The basis for a **grouped train/test split** — near-identical genomes must never
   land on both sides of the split, and ideally the test set includes at least one
   clade never seen during training.
2. An **extra model feature** — bacteria in a lineage historically associated with
   resistance carry circumstantial evidence, separate from and complementary to a
   directly-detected resistance gene.

Organism used: **Klebsiella pneumoniae** (a WHO critical-priority pathogen; acquired
carbapenem resistance in this species spreads mainly through a small number of
globally dominant clones, which is exactly what this pipeline is built to surface).

## Why this order of operations matters

The tree in this repo is built from **whole-genome k-mer content**, not from AMR
genes. If it were built from AMR genes, "clade" and "resistance gene" would just be
the same signal restated twice, and the whole point of having two independent
evidence tracks (direct gene evidence vs. lineage-based circumstantial evidence)
would collapse. Keep Track A (AMR annotation) and Track B (this repo) computed
separately, and only join them afterward.

## Pipeline

```
BV-BRC API (free, no key required)
        │
        ▼
download_genomes.py     → pulls K. pneumoniae genomes that have real
                           lab-measured AMR phenotype records, and their
                           assembled contig FASTA files
        │
        ▼
sketch_genomes.py        → MinHash sketch of each genome (sourmash)
        │
        ▼
distance_matrix.py       → all-vs-all genetic distance matrix from sketches
        │
        ▼
build_tree.py            → neighbor-joining tree (Newick + PNG) from the
                            distance matrix
        │
        ▼
cut_clades.py             → cuts the distance matrix into discrete clade
                            IDs via hierarchical clustering
        │
        ▼
outputs/clade_assignments.csv   ← final Track B deliverable:
                                   genome_id → clade_id
```

Run everything with:

```bash
python -m src.pipeline --all
```

or run each stage individually (useful while developing):

```bash
python -m src.pipeline --download
python -m src.pipeline --sketch
python -m src.pipeline --distance
python -m src.pipeline --tree
python -m src.pipeline --clades
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

No API keys are required — the BV-BRC Data API serves public data without
authentication.

## Repo structure

```
genome-firewall-phylo/
├── README.md
├── requirements.txt
├── .gitignore
├── config.yaml              ← all tunable parameters live here
├── src/
│   ├── bvbrc_client.py      ← thin wrapper around the BV-BRC REST API
│   ├── download_genomes.py  ← Stage 1: pull genome list + FASTA files
│   ├── sketch_genomes.py    ← Stage 2: MinHash sketches
│   ├── distance_matrix.py   ← Stage 3: pairwise distance matrix
│   ├── build_tree.py        ← Stage 4: neighbor-joining tree
│   ├── cut_clades.py        ← Stage 5: discrete clade assignment
│   └── pipeline.py          ← CLI entry point, orchestrates all stages
├── data/
│   ├── raw/                 ← downloaded FASTA + metadata (gitignored, regenerable)
│   └── processed/           ← sketches, distance matrix (gitignored, regenerable)
└── outputs/
    ├── tree.nwk
    ├── tree.png
    └── clade_assignments.csv
```

`data/` and most of `outputs/` are gitignored on purpose — they're large and fully
regenerable by re-running the pipeline. Only the small final CSVs are worth
committing if you want them versioned.

## Data hygiene

`download_genomes.py` intentionally keeps only the metadata fields needed
downstream (`genome_id`, `genome_name`, `genome_length`, `contigs`) — BV-BRC genome
records carry 70+ metadata attributes, most of which are irrelevant noise for this
pipeline and are dropped on ingestion rather than carried through and cleaned later.

## Next steps (not in this repo)

- Track A: AMR gene/mutation annotation via AMRFinderPlus
- Join Track A + Track B output on `genome_id`
- Grouped train/calibration/test split by `clade_id`
- Per-antibiotic predictor, calibration, Streamlit decision-report app
