from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class GenomeSearchResult(BaseModel):
    uid: str
    accession: str
    title: str
    length: int = Field(ge=0)
    updated_at: str | None = None


class GenomeSearchResponse(BaseModel):
    organism: str
    results: list[GenomeSearchResult]


class GenomeSequenceResponse(BaseModel):
    source: str = "ncbi"
    uid: str
    accession: str
    header: str
    sequence: str
    length: int = Field(ge=1)


class AmrFinderRequest(BaseModel):
    fasta: str = Field(min_length=4, max_length=25_000_000)
    organism: str | None = Field(default=None, min_length=2, max_length=120)


class AmrFinderResponse(BaseModel):
    schema_version: str = "1.0"
    success: bool = True
    service: str = "amrfinderplus"
    organism: str | None = None
    predicted_protein_count: int = Field(ge=0)
    finding_count: int = Field(ge=0)
    findings: list[dict[str, str]]
    detected_features: dict[str, bool]
    raw_output: str


class AmrFinderStatusResponse(BaseModel):
    configured: bool
    reachable: bool
    protein_mode_ready: bool | None
    detail: str


class PhylogenyGenomeInput(BaseModel):
    genome_id: str = Field(
        min_length=1,
        max_length=120,
        pattern=r"^[A-Za-z0-9_.:-]+$",
    )
    fasta: str = Field(min_length=4, max_length=25_000_000)


class PhylogenyBuildRequest(BaseModel):
    genomes: list[PhylogenyGenomeInput] = Field(min_length=2, max_length=50)
    kmer_size: int = Field(default=21, ge=15, le=51)
    scaled: int = Field(default=1000, ge=1, le=100_000)
    clade_distance_threshold: float = Field(default=0.08, gt=0, le=1)
    linkage_method: Literal["average", "complete", "single"] = "average"

    @field_validator("kmer_size")
    @classmethod
    def require_odd_kmer_size(cls, value: int) -> int:
        if value % 2 == 0:
            raise ValueError("kmer_size must be odd.")
        return value

    @model_validator(mode="after")
    def validate_genome_collection(self) -> "PhylogenyBuildRequest":
        genome_ids = [genome.genome_id for genome in self.genomes]
        if len(genome_ids) != len(set(genome_ids)):
            raise ValueError("genome_id values must be unique.")
        total_fasta_size = sum(len(genome.fasta) for genome in self.genomes)
        if total_fasta_size > 50_000_000:
            raise ValueError("Combined FASTA input exceeds 50,000,000 characters.")
        return self


class PhylogenyDistanceRow(BaseModel):
    genome_id: str
    distances: dict[str, float]


class PhylogenyCladeAssignment(BaseModel):
    genome_id: str
    clade_id: int = Field(ge=1)


class PhylogenyParameters(BaseModel):
    kmer_size: int
    scaled: int
    distance_metric: str
    tree_method: str
    linkage_method: str
    clade_distance_threshold: float


class PhylogenyTreeNode(BaseModel):
    name: str | None = None
    branch_length: float | None = None
    children: list["PhylogenyTreeNode"] = Field(default_factory=list)


class PhylogenyBuildResponse(BaseModel):
    schema_version: str = "1.0"
    genome_count: int = Field(ge=2)
    newick: str
    tree: PhylogenyTreeNode
    distance_matrix: list[PhylogenyDistanceRow]
    clade_assignments: list[PhylogenyCladeAssignment]
    parameters: PhylogenyParameters
