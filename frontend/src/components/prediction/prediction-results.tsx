import { CheckCircle2, CircleHelp, FlaskConical, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type {
  AntibioticPrediction,
  EvidenceCategory,
  PredictionCall,
  PredictionReport,
  TargetGateStatus,
} from "@/types/prediction"

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

export function PredictionResults({
  prediction,
}: {
  prediction: PredictionReport
}) {
  const noCallCount = prediction.predictions.filter(
    (item) => item.call === "no_call"
  ).length

  return (
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
            <p className="font-heading text-2xl font-semibold">{noCallCount}</p>
            <p className="text-xs text-muted-foreground">
              Uncertain or unsupported
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-none">
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">Mapped features</p>
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
                Live output from genome_firewall_models.pkl for{" "}
                {prediction.supported_species}.
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
  )
}
