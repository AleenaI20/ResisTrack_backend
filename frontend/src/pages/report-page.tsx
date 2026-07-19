import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  XCircle,
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
import { Progress } from "@/components/ui/progress"
import { predictAntibiotics } from "@/lib/api"
import { getGenomeDetail, getGenomeLabel } from "@/lib/genome-label"
import type { AmrFinderAnalysis } from "@/types/analysis"
import type { CohortGenome } from "@/types/genome"
import type {
  AntibioticPrediction,
  EvidenceCategory,
  PredictionCall,
  PredictionReport,
  TargetGateStatus,
} from "@/types/prediction"

type ReportPageProps = {
  primary: CohortGenome
  analysis: AmrFinderAnalysis
  prediction: PredictionReport | null
  primaryClade: number | null
  onPredictionChange: (prediction: PredictionReport | null) => void
  onBack: () => void
}

const callDetails: Record<
  PredictionCall,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  likely_to_work: {
    label: "Likely to work",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  likely_to_fail: {
    label: "Likely to fail",
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-800",
  },
  no_call: {
    label: "No-call",
    icon: CircleHelp,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
}

const evidenceLabels: Record<EvidenceCategory, string> = {
  known_resistance_marker: "Known resistance marker",
  statistical_association: "Statistical association",
  no_known_signal: "No known signal",
}

const targetGateLabels: Record<TargetGateStatus, string> = {
  not_required_for_fail_call: "Target gate not required for fail call",
  not_confirmed: "Target presence not confirmed",
  not_evaluated: "Target gate not evaluated",
}

function formatDrug(value: string): string {
  return value
    .split("/")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" / ")
}

function PredictionRow({
  prediction,
}: {
  prediction: AntibioticPrediction
}) {
  const details = callDetails[prediction.call]
  const CallIcon = details.icon
  const confidence = Math.round(prediction.confidence * 100)

  return (
    <tr className="border-b border-border/70 last:border-b-0">
      <td className="min-w-44 px-4 py-4 align-top">
        <p className="text-sm font-medium">{formatDrug(prediction.drug)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {prediction.model_tier} evidence tier
        </p>
      </td>
      <td className="min-w-40 px-4 py-4 align-top">
        <Badge variant="outline" className={details.className}>
          <CallIcon aria-hidden="true" />
          {details.label}
        </Badge>
      </td>
      <td className="min-w-44 px-4 py-4 align-top">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium">{confidence}%</span>
          <span className="text-muted-foreground">
            P(resistant){" "}
            {Math.round(prediction.resistance_probability * 100)}%
          </span>
        </div>
        <Progress value={confidence} className="mt-2" />
      </td>
      <td className="min-w-56 px-4 py-4 align-top">
        <p className="text-xs font-medium">
          {evidenceLabels[prediction.evidence_category]}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {prediction.supporting_features.length > 0
            ? prediction.supporting_features.join(", ")
            : "No directional AMR feature supported this call."}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {prediction.call_reason}
        </p>
        <Badge variant="outline" className="mt-2">
          {targetGateLabels[prediction.target_gate_status]}
        </Badge>
      </td>
    </tr>
  )
}

export function ReportPage({
  primary,
  analysis,
  prediction,
  primaryClade,
  onPredictionChange,
  onBack,
}: ReportPageProps) {
  const [isPredicting, setIsPredicting] = useState(!prediction)
  const [error, setError] = useState<string | null>(null)
  const requestController = useRef<AbortController | null>(null)

  async function handleRetry() {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setIsPredicting(true)
    setError(null)

    try {
      const result = await predictAntibiotics(
        analysis.detected_features,
        analysis.organism,
        controller.signal
      )
      onPredictionChange(result)
    } catch (predictionError) {
      if (
        predictionError instanceof DOMException &&
        predictionError.name === "AbortError"
      ) {
        return
      }
      setError(
        predictionError instanceof Error
          ? predictionError.message
          : "Antibiotic-response prediction failed."
      )
    } finally {
      if (!controller.signal.aborted) {
        setIsPredicting(false)
      }
    }
  }

  useEffect(() => {
    if (prediction) {
      return
    }

    const controller = new AbortController()
    requestController.current = controller
    void predictAntibiotics(
      analysis.detected_features,
      analysis.organism,
      controller.signal
    )
      .then(onPredictionChange)
      .catch((predictionError: unknown) => {
        if (
          predictionError instanceof DOMException &&
          predictionError.name === "AbortError"
        ) {
          return
        }
        setError(
          predictionError instanceof Error
            ? predictionError.message
            : "Antibiotic-response prediction failed."
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsPredicting(false)
        }
      })

    return () => controller.abort()
  }, [
    analysis.detected_features,
    analysis.organism,
    onPredictionChange,
    prediction,
  ])

  const noCallCount =
    prediction?.predictions.filter((item) => item.call === "no_call").length ?? 0

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-5 md:p-8 lg:pt-10">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Report
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Genome Firewall decision report
        </h1>
        <p className="text-sm text-muted-foreground">
          Species-scoped antibiotic-response predictions for the primary
          genome.
        </p>
      </div>

      <Alert className="border-amber-300 bg-amber-50 text-amber-950">
        <ShieldAlert aria-hidden="true" />
        <AlertTitle>Research prototype — human confirmation required</AlertTitle>
        <AlertDescription className="text-amber-900/80">
          {prediction?.disclaimer ??
            "Confirm every result with standard laboratory testing before any clinical use."}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="rounded-md"
        >
          <ArrowLeft aria-hidden="true" />
          Back to phylogeny
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPredicting}
          onClick={() => void handleRetry()}
          className="rounded-md"
        >
          {isPredicting ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          Run prediction again
        </Button>
      </div>

      <Card className="rounded-lg shadow-none">
        <CardHeader className="border-b border-border/70">
          <CardTitle>Primary genome and model scope</CardTitle>
          <CardDescription>
            This model supports Klebsiella pneumoniae only.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {getGenomeLabel(primary.genome)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {getGenomeDetail(primary.genome)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Primary</Badge>
            <Badge variant="outline">
              {prediction?.supported_species ?? "Klebsiella pneumoniae"}
            </Badge>
            {primaryClade ? (
              <Badge variant="outline">Clade {primaryClade}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!analysis.organism ? (
        <Alert>
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Species metadata was not supplied</AlertTitle>
          <AlertDescription>
            The app is assuming this local FASTA is Klebsiella pneumoniae.
            Species identification is outside this prototype&apos;s scope.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Prediction could not complete</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isPredicting && !prediction ? (
        <Card className="rounded-lg shadow-none">
          <CardContent className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Mapping AMRFinderPlus features into five antibiotic models…
          </CardContent>
        </Card>
      ) : null}

      {prediction ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="rounded-lg shadow-none">
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">Antibiotics</p>
                <p className="font-heading text-2xl font-semibold">
                  {prediction.predictions.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Species-specific models
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-none">
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">No-calls</p>
                <p className="font-heading text-2xl font-semibold">
                  {noCallCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  Uncertain or unsupported
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-lg shadow-none">
              <CardContent className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Mapped AMR features
                </p>
                <p className="font-heading text-2xl font-semibold">
                  {prediction.matched_features.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {prediction.unmatched_features.length} unmatched
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-lg shadow-none">
            <CardHeader className="border-b border-border/70">
              <div className="flex items-start gap-3">
                <FlaskConical
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <CardTitle>Antibiotic-response predictions</CardTitle>
                  <CardDescription>
                    Model score is the larger class probability. Evidence tiers,
                    uncertainty margins, and the target gate can force a no-call.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Drug</th>
                      <th className="px-4 py-3 font-medium">Call</th>
                      <th className="px-4 py-3 font-medium">Model score</th>
                      <th className="px-4 py-3 font-medium">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.predictions.map((item) => (
                      <PredictionRow key={item.drug} prediction={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
