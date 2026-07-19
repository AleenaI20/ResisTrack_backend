import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  GitBranch,
  LoaderCircle,
  RefreshCw,
} from "lucide-react"

import { DistanceMatrix } from "@/components/phylogeny/distance-matrix"
import { PhylogenyTree } from "@/components/phylogeny/phylogeny-tree"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buildPhylogeny } from "@/lib/api"
import { genomeToFasta } from "@/lib/genome-fasta"
import { getGenomeDetail, getGenomeLabel } from "@/lib/genome-label"
import { nearestNeighbor } from "@/lib/phylogeny-layout"
import { choosePhylogenyParameters } from "@/lib/phylogeny-params"
import type { CohortGenome } from "@/types/genome"
import type { PhylogenyBuildResponse } from "@/types/phylogeny"

type PhylogenyPageProps = {
  cohort: CohortGenome[]
  primaryGenomeId: string
  result: PhylogenyBuildResponse | null
  onResultChange: (result: PhylogenyBuildResponse | null) => void
  onBack: () => void
  onContinue: () => void
}

export function PhylogenyPage({
  cohort,
  primaryGenomeId,
  result,
  onResultChange,
  onBack,
  onContinue,
}: PhylogenyPageProps) {
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedGenomeId, setSelectedGenomeId] = useState<string | null>(
    primaryGenomeId
  )
  const [buildNonce, setBuildNonce] = useState(0)
  const requestController = useRef<AbortController | null>(null)

  const cohortSignature = useMemo(
    () => cohort.map((entry) => entry.id).join("|"),
    [cohort]
  )

  const cladeById = useMemo(
    () =>
      new Map(
        (result?.clade_assignments ?? []).map((assignment) => [
          assignment.genome_id,
          assignment.clade_id,
        ])
      ),
    [result]
  )

  const selectedNeighbor =
    result && selectedGenomeId
      ? nearestNeighbor(selectedGenomeId, result.distance_matrix)
      : null

  const selectedEntry =
    cohort.find((entry) => entry.id === selectedGenomeId) ?? null

  useEffect(() => {
    if (result) {
      return
    }

    let cancelled = false

    async function autoBuild() {
      requestController.current?.abort()
      const controller = new AbortController()
      requestController.current = controller
      setIsBuilding(true)
      setError(null)

      try {
        const genomes = await Promise.all(
          cohort.map(async (entry) => ({
            genome_id: entry.id,
            fasta: await genomeToFasta(entry.genome),
          }))
        )
        const parameters = choosePhylogenyParameters(genomes)
        const response = await buildPhylogeny(
          { genomes, ...parameters },
          controller.signal
        )
        if (cancelled) {
          return
        }
        onResultChange(response)
        setSelectedGenomeId(primaryGenomeId)
      } catch (buildError) {
        if (
          cancelled ||
          (buildError instanceof DOMException &&
            buildError.name === "AbortError")
        ) {
          return
        }
        setError(
          buildError instanceof Error
            ? buildError.message
            : "Phylogeny build failed."
        )
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setIsBuilding(false)
        }
      }
    }

    void autoBuild()
    return () => {
      cancelled = true
      requestController.current?.abort()
    }
  }, [
    buildNonce,
    cohort,
    cohortSignature,
    onResultChange,
    primaryGenomeId,
    result,
  ])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-5 md:p-8 lg:pt-10">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Review
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Phylogenetic context
        </h1>
        <p className="text-sm text-muted-foreground">
          Whole-genome neighbor-joining tree for the selected cohort. AMR
          findings remain a separate evidence track.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="rounded-md"
        >
          <ArrowLeft aria-hidden="true" />
          Back to analysis
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isBuilding}
            onClick={() => {
              onResultChange(null)
              setBuildNonce((value) => value + 1)
            }}
            className="rounded-md"
          >
            {isBuilding ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}
            Rebuild tree
          </Button>
          <Button
            type="button"
            disabled={isBuilding || !result}
            onClick={onContinue}
            className="rounded-md"
          >
            Continue to report
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Tree could not be built</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isBuilding && !result ? (
        <Card className="rounded-lg shadow-none">
          <CardContent className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Building whole-genome phylogeny for {cohort.length} genomes…
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="rounded-lg shadow-none">
              <CardContent className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Genomes
                </p>
                <p className="font-heading text-2xl font-semibold">
                  {result.genome_count}
                </p>
                <p className="text-xs text-muted-foreground">In cohort tree</p>
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-none">
              <CardContent className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Clades
                </p>
                <p className="font-heading text-2xl font-semibold">
                  {
                    new Set(
                      result.clade_assignments.map(
                        (assignment) => assignment.clade_id
                      )
                    ).size
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  Threshold {result.parameters.clade_distance_threshold}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-none">
              <CardContent className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Method
                </p>
                <p className="font-heading text-lg font-semibold leading-snug">
                  Neighbor joining
                </p>
                <p className="text-xs text-muted-foreground">
                  k={result.parameters.kmer_size}, scaled=
                  {result.parameters.scaled}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card className="rounded-lg shadow-none">
              <CardHeader className="border-b border-border/70">
                <CardTitle>Phylogenetic tree</CardTitle>
                <CardDescription>
                  Select a leaf to inspect clade membership and nearest neighbor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PhylogenyTree
                  result={result}
                  primaryGenomeId={primaryGenomeId}
                  selectedGenomeId={selectedGenomeId}
                  onSelectGenome={setSelectedGenomeId}
                />
              </CardContent>
            </Card>

            <Card className="rounded-lg shadow-none">
              <CardHeader className="border-b border-border/70">
                <CardTitle>Selected genome</CardTitle>
                <CardDescription>
                  Details for the highlighted leaf.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedEntry ? (
                  <>
                    <div>
                      <p className="text-sm font-medium">
                        {getGenomeLabel(selectedEntry.genome)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getGenomeDetail(selectedEntry.genome)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedEntry.id}</Badge>
                      {selectedEntry.isPrimary ? (
                        <Badge variant="secondary">Primary</Badge>
                      ) : null}
                      {cladeById.has(selectedEntry.id) ? (
                        <Badge variant="outline">
                          Clade {cladeById.get(selectedEntry.id)}
                        </Badge>
                      ) : null}
                    </div>
                    {selectedNeighbor ? (
                      <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Nearest neighbor
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {selectedNeighbor.genomeId}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Distance {selectedNeighbor.distance.toFixed(4)}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a leaf on the tree.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-lg shadow-none">
            <CardHeader className="border-b border-border/70">
              <div className="flex items-start gap-3">
                <GitBranch
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <CardTitle>Distance matrix</CardTitle>
                  <CardDescription>
                    Pairwise whole-genome distances as 1 − Jaccard similarity.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DistanceMatrix
                result={result}
                selectedGenomeId={selectedGenomeId}
                onSelectGenome={setSelectedGenomeId}
              />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
