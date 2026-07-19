import { Check, LockKeyhole, ServerOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
type AnalysisStatusPanelProps = {
  selectedFileName: string | null
}

const pipelineSteps = [
  {
    title: "Upload genome",
    detail: "Select a quality-checked reconstructed FASTA file.",
  },
  {
    title: "Analyze resistance",
    detail: "Run feature extraction and antibiotic-response prediction.",
  },
  {
    title: "Review predictions",
    detail: "Inspect confidence, evidence categories, and no-call results.",
  },
  {
    title: "Decision report",
    detail: "Confirm findings with laboratory testing and export the report.",
  },
] as const

export function AnalysisStatusPanel({
  selectedFileName,
}: AnalysisStatusPanelProps) {
  const currentStage = selectedFileName ? 2 : 1

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Your progress</CardTitle>
          <Badge
            variant="outline"
            className="rounded-md border-slate-200 bg-slate-50 text-slate-700"
          >
            <ServerOff className="size-3.5" aria-hidden="true" />
            API not connected
          </Badge>
        </div>
        <CardDescription>
          Stage {currentStage} of 4 ·{" "}
          {selectedFileName
            ? "Your genome is selected, but analysis cannot start yet."
            : "Select a genome to begin."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ol className="relative">
          {pipelineSteps.map((step, index) => {
            const stageNumber = index + 1
            const isComplete = stageNumber < currentStage
            const isCurrent = stageNumber === currentStage
            const isBlocked = isCurrent && stageNumber === 2

            return (
            <li
              key={step.title}
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex min-h-20 gap-4"
            >
              {index < pipelineSteps.length - 1 ? (
                <span
                  className={`absolute top-9 left-[17px] h-[calc(100%-0.75rem)] w-px ${
                    isComplete ? "bg-primary" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
              ) : null}
              <div
                className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                  isComplete
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-accent text-primary ring-2 ring-primary/15"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {isComplete ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : isBlocked ? (
                  <LockKeyhole className="size-4" aria-hidden="true" />
                ) : (
                  stageNumber
                )}
                <span className="sr-only">Stage {stageNumber}</span>
              </div>
              <div className="min-w-0 flex-1 pb-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={`text-sm font-semibold ${
                      !isComplete && !isCurrent
                        ? "text-muted-foreground"
                        : ""
                    }`}
                  >
                    {stageNumber}. {step.title}
                  </p>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isComplete
                      ? "Complete"
                      : isBlocked
                        ? "Blocked"
                        : isCurrent
                          ? "Current"
                          : "Waiting"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {isBlocked
                    ? `${selectedFileName} is ready. Connect the analysis API to continue.`
                    : step.detail}
                </p>
              </div>
            </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
