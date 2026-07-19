import type {
  NcbiGenomeSequence,
  NcbiGenomeSummary,
} from "@/types/genome"
import type { AmrFinderAnalysis } from "@/types/analysis"
import type {
  PhylogenyBuildRequest,
  PhylogenyBuildResponse,
} from "@/types/phylogeny"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000"

type GenomeSearchResponse = {
  organism: string
  results: NcbiGenomeSummary[]
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}.`
    try {
      const body = (await response.json()) as {
        detail?: string | Array<{ msg?: string }>
      }
      if (typeof body.detail === "string") {
        message = body.detail
      } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        message = body.detail[0].msg
      }
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message)
  }

  return (await response.json()) as T
}

export function searchNcbiGenomes(
  organism: string,
  signal?: AbortSignal
): Promise<GenomeSearchResponse> {
  const params = new URLSearchParams({
    organism,
    limit: "5",
  })
  return request<GenomeSearchResponse>(
    `/api/ncbi/genomes/search?${params.toString()}`,
    { signal }
  )
}

export function fetchNcbiGenome(
  uid: string,
  signal?: AbortSignal
): Promise<NcbiGenomeSequence> {
  return request<NcbiGenomeSequence>(`/api/ncbi/genomes/${uid}`, { signal })
}

export function analyzeAmrFinder(
  fasta: string,
  organism?: string,
  signal?: AbortSignal
): Promise<AmrFinderAnalysis> {
  return request<AmrFinderAnalysis>("/api/amrfinderplus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fasta,
      organism: organism || null,
    }),
    signal,
  })
}

export function buildPhylogeny(
  body: PhylogenyBuildRequest,
  signal?: AbortSignal
): Promise<PhylogenyBuildResponse> {
  return request<PhylogenyBuildResponse>("/api/phylogeny/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
}
