import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import {
  Database,
  Dna,
  LoaderCircle,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fetchNcbiGenome, searchNcbiGenomes } from "@/lib/api"
import { genomeIdentityKey } from "@/lib/genome-label"
import type {
  CohortGenome,
  NcbiGenomeSequence,
  NcbiGenomeSummary,
} from "@/types/genome"
import { MAX_COHORT_SIZE } from "@/types/genome"

type NcbiGenomeSearchProps = {
  cohort: CohortGenome[]
  onAddGenome: (genome: NcbiGenomeSequence) => void
}

const baseCountFormatter = new Intl.NumberFormat("en-US")

const SEEDED_ORGANISMS = [
  "Escherichia coli",
  "Staphylococcus aureus",
  "Klebsiella pneumoniae",
  "Pseudomonas aeruginosa",
  "Mycobacterium tuberculosis",
  "Salmonella enterica",
  "Acinetobacter baumannii",
  "Enterococcus faecium",
] as const

export function NcbiGenomeSearch({
  cohort,
  onAddGenome,
}: NcbiGenomeSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NcbiGenomeSummary[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [loadingUid, setLoadingUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestController = useRef<AbortController | null>(null)
  const selectedKeys = new Set(
    cohort.map((entry) => genomeIdentityKey(entry.genome))
  )
  const isFull = cohort.length >= MAX_COHORT_SIZE

  useEffect(() => {
    return () => requestController.current?.abort()
  }, [])

  async function runSearch(organismName: string) {
    const organism = organismName.trim()
    if (organism.length < 2) {
      setError("Enter an organism name.")
      return
    }

    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setQuery(organism)
    setIsSearching(true)
    setError(null)

    try {
      const response = await searchNcbiGenomes(organism, controller.signal)
      setResults(response.results)
    } catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === "AbortError") {
        return
      }
      setResults(null)
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Unable to search NCBI."
      )
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false)
      }
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runSearch(query)
  }

  async function handleSelect(result: NcbiGenomeSummary) {
    if (isFull) {
      setError(`Cohort is limited to ${MAX_COHORT_SIZE} genomes.`)
      return
    }

    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setLoadingUid(result.uid)
    setError(null)

    try {
      const genome = await fetchNcbiGenome(result.uid, controller.signal)
      onAddGenome({
        ...genome,
        organism: query.trim() || undefined,
      })
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        return
      }
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load the selected genome."
      )
    } finally {
      if (!controller.signal.aborted) {
        setLoadingUid(null)
      }
    }
  }

  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Search NCBI genomes</CardTitle>
        <CardDescription>
          Add complete genomic records to the cohort by organism name.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={handleSearch}>
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Mycobacterium tuberculosis"
              aria-label="Organism name"
              className="h-10 rounded-md pl-9"
            />
          </div>
          <Button
            type="submit"
            disabled={isSearching || query.trim().length < 2}
            className="h-10 rounded-md px-4"
          >
            {isSearching ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Search aria-hidden="true" />
            )}
            Search
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Common pathogens
          </p>
          <div
            className="grid gap-2 sm:grid-cols-2"
            role="group"
            aria-label="Common pathogen genomes"
          >
            {SEEDED_ORGANISMS.map((organism) => {
              const isActive = query === organism && results !== null

              return (
                <Button
                  key={organism}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSearching}
                  onClick={() => runSearch(organism)}
                  className={
                    isActive
                      ? "h-auto justify-start rounded-md border-primary bg-accent px-3 py-2 text-left whitespace-normal"
                      : "h-auto justify-start rounded-md px-3 py-2 text-left whitespace-normal"
                  }
                >
                  <Dna className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 text-xs leading-snug">{organism}</span>
                </Button>
              )
            })}
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {isFull ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Cohort is full. Remove a genome before adding another.
          </p>
        ) : null}

        {results?.length === 0 ? (
          <div className="border-t border-border py-8 text-center">
            <Database
              className="mx-auto size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-medium">No complete genomes found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Check the organism spelling or try a broader taxonomic name.
            </p>
          </div>
        ) : null}

        {results && results.length > 0 ? (
          <div className="divide-y divide-border border-y border-border">
            {results.map((result) => {
              const identity = `ncbi:${result.uid}`
              const isSelected = selectedKeys.has(identity)
              const isLoading = loadingUid === result.uid

              return (
                <div
                  key={result.uid}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Dna
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{result.accession}</p>
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {result.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {baseCountFormatter.format(result.length)} bp
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={isSelected ? "secondary" : "outline"}
                    size="sm"
                    disabled={isLoading || isSelected || isFull}
                    onClick={() => handleSelect(result)}
                    className="rounded-md"
                  >
                    {isLoading ? (
                      <LoaderCircle
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    {isSelected
                      ? "In cohort"
                      : isLoading
                        ? "Loading"
                        : "Add genome"}
                  </Button>
                </div>
              )
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
