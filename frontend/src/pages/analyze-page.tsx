import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Dna,
  LoaderCircle,
  Microscope,
} from "lucide-react"

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
import { analyzeAmrFinder } from "@/lib/api"
import { genomeToFasta } from "@/lib/genome-fasta"
import { getGenomeDetail, getGenomeLabel } from "@/lib/genome-label"
import type { AmrFinderAnalysis } from "@/types/analysis"
import type { CohortGenome } from "@/types/genome"

type AnalyzePageProps = {
  primary: CohortGenome
  cohortSize: number
  analysis: AmrFinderAnalysis | null
  onAnalysisChange: (analysis: AmrFinderAnalysis | null) => void
  onBack: () => void
  onContinue: () => void
}

export function AnalyzePage({
  primary,
  cohortSize,
  analysis,
  onAnalysisChange,
  onBack,
  onContinue,
}: AnalyzePageProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => requestController.current?.abort()
  }, [])

  async function handleAnalyze() {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setIsAnalyzing(true)
    setError(null)
    onAnalysisChange(null)

    try {
      const fasta = await genomeToFasta(primary.genome)
      const result = await analyzeAmrFinder(
        fasta,
        primary.genome.source === "ncbi"
          ? primary.genome.organism
          : undefined,
        controller.signal
      )
      onAnalysisChange(result)
    } catch (analysisError) {
      if (
        analysisError instanceof DOMException &&
        analysisError.name === "AbortError"
      ) {
        return
      }
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "AMRFinderPlus analysis failed."
      )
    } finally {
      if (!controller.signal.aborted) {
        setIsAnalyzing(false)
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-5 md:p-8 lg:pt-10">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Analyze
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Resistance analysis
        </h1>
        <p className="text-sm text-muted-foreground">
          Run AMRFinderPlus on the primary genome. The remaining{" "}
          {Math.max(cohortSize - 1, 0)} cohort genomes are reserved for
          phylogeny.
        </p>
      </div>

      <Card className="rounded-lg shadow-none">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Primary genome</CardTitle>
          <CardDescription>
            Confirm the AMRFinderPlus input before starting analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3">
            <Dna
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium">
                  {getGenomeLabel(primary.genome)}
                </p>
                <Badge variant="secondary">Primary</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {getGenomeDetail(primary.genome)} · {primary.id}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="rounded-md"
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={isAnalyzing}
                onClick={handleAnalyze}
                className="rounded-md"
              >
                {isAnalyzing ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Microscope aria-hidden="true" />
                )}
                {isAnalyzing ? "Analyzing genome" : "Run AMRFinderPlus"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!analysis}
                onClick={onContinue}
                className="rounded-md"
              >
                Continue to phylogeny
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Analysis could not complete</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {analysis ? (
        <Card className="rounded-lg shadow-none">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Genome Reader results</CardTitle>
                <CardDescription>
                  Prodigal protein predictions analyzed by AMRFinderPlus.
                </CardDescription>
              </div>
              <Badge variant="outline">
                <CheckCircle2 aria-hidden="true" />
                Complete
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-heading text-2xl font-semibold">
                {analysis.finding_count}
              </p>
              <p className="text-xs text-muted-foreground">
                AMRFinderPlus findings across{" "}
                {analysis.predicted_protein_count.toLocaleString()} predicted
                proteins
              </p>
            </div>

            {Object.keys(analysis.detected_features).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {Object.keys(analysis.detected_features).map((feature) => (
                  <Badge key={feature} variant="secondary">
                    {feature}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                No AMR genes or curated resistance mutations were reported.
              </p>
            )}

            {analysis.findings.length > 0 ? (
              <div className="divide-y divide-border border-y border-border">
                {analysis.findings.map((finding, index) => (
                  <div
                    key={`${finding["Gene symbol"] || "finding"}-${index}`}
                    className="py-3"
                  >
                    <p className="text-sm font-medium">
                      {finding["Gene symbol"] ||
                        finding["Sequence name"] ||
                        "AMR finding"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        finding["Element subtype"],
                        finding["Class"],
                        finding["Method"],
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
