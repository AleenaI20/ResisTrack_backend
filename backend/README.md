# Resistrace API

Backend services for Resistrace:

- NCBI genome search and in-memory FASTA retrieval
- In-memory bacterial gene prediction and hosted AMRFinderPlus analysis
- Whole-genome phylogenetics adapted from Track B

## Endpoints

- `GET /api/health`
- `GET /api/amrfinderplus/status`
- `POST /api/amrfinderplus`
- `GET /api/ncbi/genomes/search?organism=Mycobacterium%20tuberculosis`
- `GET /api/ncbi/genomes/{uid}`
- `POST /api/phylogeny/build`
- `POST /api/predict`

The NCBI sequence endpoint returns the FASTA header and genome sequence as
JSON. It does not write a FASTA file to disk.

## Hosted AMRFinderPlus

`POST /api/amrfinderplus` accepts assembled bacterial nucleotide FASTA.
Resistrace uses Pyrodigal to predict and translate protein-coding genes in
memory, sends the resulting amino-acid FASTA to the configured hosted service,
and parses its TSV output. No intermediate FASTA is written to disk.

The response contains:

- `predicted_protein_count`: proteins generated from the genome
- `findings`: normalized AMRFinderPlus TSV rows
- `detected_features`: sparse positive gene/mutation features
- `raw_output`: the original TSV for reproducibility

Configure the upstream URL with:

```bash
export AMRFINDERPLUS_API_URL="https://your-service.example"
```

The default development service is
`https://cams-ftp-veteran-reported.trycloudflare.com`. It accepts protein
FASTA, which is why gene prediction and translation happen before the hosted
request.

## Phylogenetics (`POST /api/phylogeny/build`)

This endpoint preserves the Track B algorithm from GitHub branch
[`phylotree`](https://github.com/6namdang/resistrace/tree/phylotree)
(commit `3e968b0`):

1. Whole-genome sourmash MinHash sketches
2. Pairwise distances as `1 - Jaccard`
3. Neighbor-joining tree with midpoint rooting
4. Hierarchical clustering into discrete clade IDs

Important design notes from the original Track B work:

- Phylogeny is built from whole-genome k-mer content only.
- AMR gene/mutation calls are intentionally excluded, so lineage remains an
  independent evidence track from AMRFinderPlus.
- The original branch also includes a BV-BRC download pipeline for training
  datasets. That bulk download path is not exposed as a public API here because
  it is a long-running offline job. The API accepts FASTA sequences you already
  have and returns the tree/clades in memory.

Example request:

```bash
curl -s http://127.0.0.1:8000/api/phylogeny/build \
  -H 'Content-Type: application/json' \
  -d '{
    "genomes": [
      {"genome_id": "g1", "fasta": ">g1\nACGTTGCATGTCAGT...\n"},
      {"genome_id": "g2", "fasta": ">g2\nACGTTGCATGTCGGT...\n"}
    ],
    "kmer_size": 21,
    "scaled": 1000,
    "clade_distance_threshold": 0.08,
    "linkage_method": "average"
  }'
```

Response fields:

- `newick`: midpoint-rooted neighbor-joining tree
- `tree`: structured hierarchy with names, branch lengths, and children for UI rendering
- `distance_matrix`: genome-to-genome Jaccard distances
- `clade_assignments`: discrete clade IDs for grouped train/test splits
- `parameters`: the exact settings used for the run

## Genome Firewall predictor (`POST /api/predict`)

The predictor loads `genome_firewall_models.pkl` once at application startup
with joblib. The trusted artifact contains five scikit-learn
logistic-regression models for **Klebsiella pneumoniae**: meropenem,
gentamicin, piperacillin/tazobactam, ciprofloxacin, and ceftazidime.

Send the `detected_features` object returned by `POST /api/amrfinderplus`:

```bash
curl -s http://127.0.0.1:8000/api/predict \
  -H 'Content-Type: application/json' \
  -d '{
    "organism": "Klebsiella pneumoniae",
    "detected_features": {
      "gene:blaKPC-2": true,
      "mutation:gyrA_S83L": true
    }
  }'
```

The service maps AMRFinderPlus names into each model's exact `active_genes`
feature order. It returns per-drug calls, model scores, resistance
probabilities, evidence categories, and unmatched input features. Per-drug
uncertainty margins produce explicit no-calls.

AMRFinderPlus reports resistance markers, not the complete set of molecular
drug targets. A model result that otherwise favors "likely to work" is
therefore conservatively returned as **no-call** unless target presence can be
confirmed. This prevents absence of a resistance marker from being presented
as susceptibility. Every response includes the mandatory laboratory-testing
disclaimer.

The artifact is scoped to K. pneumoniae. Requests naming another organism are
rejected. Local FASTA inputs without organism metadata are accepted for demo
use, with an explicit scope assumption in the frontend.

Override the trusted local artifact path with:

```bash
export GENOME_FIREWALL_MODEL_PATH="/absolute/path/to/models.pkl"
```

Never load an untrusted artifact: joblib uses Python's pickle model and can
execute code during deserialization.

## Run locally

```bash
source venv/bin/activate
pip install -e ".[dev]"
export NCBI_EMAIL="your-developer-email@example.com"
uvicorn app.main:app --reload
```

`NCBI_EMAIL` is strongly recommended by NCBI so they can contact the developer
if there is a problem. `NCBI_API_KEY` is optional; without it, Resistrace
throttles itself to three NCBI requests per second. With a key, it uses ten per
second. The default frontend origins are `http://localhost:5173` and
`http://127.0.0.1:5173`; override them with comma-separated `CORS_ORIGINS`.

## Offline Track B pipeline

The original BV-BRC download + sketch + distance + tree + clade pipeline from
[`phylotree`](https://github.com/6namdang/resistrace/tree/phylotree) is
preserved under `backend/phylotree/` for offline training-set generation:

```bash
cd phylotree
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.pipeline --all
```

Use `POST /api/phylogeny/build` for interactive tree creation from FASTA
already held by the app.

## Tests

```bash
pytest
```
