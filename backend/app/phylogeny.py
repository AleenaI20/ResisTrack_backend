"""Whole-genome phylogenetics adapted from Track B commit 3e968b0.

The implementation keeps the original algorithmic boundaries:
whole-genome sourmash sketches, Jaccard distances, a neighbor-joining tree,
and hierarchical clade assignment. It runs in memory for API use and never
mixes AMR marker data into the phylogenetic signal.
"""

from io import StringIO

import numpy as np
import sourmash
from Bio import Phylo, SeqIO
from Bio.Phylo.TreeConstruction import DistanceMatrix, DistanceTreeConstructor
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import squareform

from app.models import (
    PhylogenyBuildRequest,
    PhylogenyBuildResponse,
    PhylogenyCladeAssignment,
    PhylogenyDistanceRow,
    PhylogenyParameters,
)


class PhylogenyError(Exception):
    """Raised when FASTA input cannot produce a valid phylogenetic result."""


def _sketch_fasta(
    genome_id: str,
    fasta: str,
    *,
    kmer_size: int,
    scaled: int,
) -> sourmash.MinHash:
    if not fasta.lstrip().startswith(">"):
        raise PhylogenyError(f"{genome_id}: input is not FASTA.")

    minhash = sourmash.MinHash(n=0, ksize=kmer_size, scaled=scaled)
    record_count = 0
    nucleotide_count = 0

    try:
        for record in SeqIO.parse(StringIO(fasta), "fasta"):
            sequence = str(record.seq).upper()
            if not sequence:
                continue
            record_count += 1
            nucleotide_count += len(sequence)
            minhash.add_sequence(sequence, force=True)
    except (TypeError, ValueError) as exc:
        raise PhylogenyError(f"{genome_id}: invalid FASTA sequence.") from exc

    if record_count == 0:
        raise PhylogenyError(f"{genome_id}: FASTA contains no sequence records.")
    if nucleotide_count < kmer_size:
        raise PhylogenyError(
            f"{genome_id}: sequence is shorter than kmer_size={kmer_size}."
        )
    if len(minhash) == 0:
        raise PhylogenyError(
            f"{genome_id}: scaled={scaled} produced an empty sketch; "
            "use a lower scaled value or a larger genome."
        )
    return minhash


def _build_distance_matrix(
    genome_ids: list[str],
    signatures: dict[str, sourmash.MinHash],
) -> np.ndarray:
    matrix = np.zeros((len(genome_ids), len(genome_ids)), dtype=float)
    for row_index, left_id in enumerate(genome_ids):
        for column_index in range(row_index + 1, len(genome_ids)):
            right_id = genome_ids[column_index]
            similarity = signatures[left_id].jaccard(signatures[right_id])
            distance = 1.0 - similarity
            matrix[row_index, column_index] = distance
            matrix[column_index, row_index] = distance
    return matrix


def _build_newick(genome_ids: list[str], matrix: np.ndarray) -> str:
    lower_triangle = [
        [float(matrix[row_index, column_index]) for column_index in range(row_index + 1)]
        for row_index in range(len(genome_ids))
    ]
    distance_matrix = DistanceMatrix(
        names=genome_ids,
        matrix=lower_triangle,
    )
    tree = DistanceTreeConstructor().nj(distance_matrix)
    tree.root_at_midpoint()

    output = StringIO()
    Phylo.write(tree, output, "newick")
    return output.getvalue().strip()


def _assign_clades(
    genome_ids: list[str],
    matrix: np.ndarray,
    *,
    linkage_method: str,
    threshold: float,
) -> list[PhylogenyCladeAssignment]:
    condensed = squareform(matrix, checks=True)
    hierarchy = linkage(condensed, method=linkage_method)
    raw_labels = fcluster(hierarchy, t=threshold, criterion="distance")

    normalized_labels: dict[int, int] = {}
    assignments: list[PhylogenyCladeAssignment] = []
    for genome_id, raw_label in zip(genome_ids, raw_labels, strict=True):
        label = int(raw_label)
        normalized_labels.setdefault(label, len(normalized_labels) + 1)
        assignments.append(
            PhylogenyCladeAssignment(
                genome_id=genome_id,
                clade_id=normalized_labels[label],
            )
        )
    return assignments


def build_phylogeny(request: PhylogenyBuildRequest) -> PhylogenyBuildResponse:
    genomes = sorted(request.genomes, key=lambda genome: genome.genome_id)
    genome_ids = [genome.genome_id for genome in genomes]
    signatures = {
        genome.genome_id: _sketch_fasta(
            genome.genome_id,
            genome.fasta,
            kmer_size=request.kmer_size,
            scaled=request.scaled,
        )
        for genome in genomes
    }
    matrix = _build_distance_matrix(genome_ids, signatures)

    distance_rows = [
        PhylogenyDistanceRow(
            genome_id=genome_id,
            distances={
                compared_id: round(float(matrix[row_index, column_index]), 8)
                for column_index, compared_id in enumerate(genome_ids)
            },
        )
        for row_index, genome_id in enumerate(genome_ids)
    ]

    return PhylogenyBuildResponse(
        genome_count=len(genome_ids),
        newick=_build_newick(genome_ids, matrix),
        distance_matrix=distance_rows,
        clade_assignments=_assign_clades(
            genome_ids,
            matrix,
            linkage_method=request.linkage_method,
            threshold=request.clade_distance_threshold,
        ),
        parameters=PhylogenyParameters(
            kmer_size=request.kmer_size,
            scaled=request.scaled,
            distance_metric="1 - sourmash MinHash Jaccard similarity",
            tree_method="neighbor joining with midpoint rooting",
            linkage_method=request.linkage_method,
            clade_distance_threshold=request.clade_distance_threshold,
        ),
    )
