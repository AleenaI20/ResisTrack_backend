export type PhylogenyGenomeInput = {
  genome_id: string
  fasta: string
}

export type PhylogenyBuildRequest = {
  genomes: PhylogenyGenomeInput[]
  kmer_size?: number
  scaled?: number
  clade_distance_threshold?: number
  linkage_method?: "average" | "complete" | "single"
}

export type PhylogenyTreeNode = {
  name: string | null
  branch_length: number | null
  children: PhylogenyTreeNode[]
}

export type PhylogenyDistanceRow = {
  genome_id: string
  distances: Record<string, number>
}

export type PhylogenyCladeAssignment = {
  genome_id: string
  clade_id: number
}

export type PhylogenyParameters = {
  kmer_size: number
  scaled: number
  distance_metric: string
  tree_method: string
  linkage_method: string
  clade_distance_threshold: number
}

export type PhylogenyBuildResponse = {
  schema_version: string
  genome_count: number
  newick: string
  tree: PhylogenyTreeNode
  distance_matrix: PhylogenyDistanceRow[]
  clade_assignments: PhylogenyCladeAssignment[]
  parameters: PhylogenyParameters
}
