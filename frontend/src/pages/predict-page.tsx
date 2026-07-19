import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Eraser,
  FlaskConical,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react"

import { PredictionResults } from "@/components/prediction/prediction-results"
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
import { fetchPredictMeta, predictAntibiotics } from "@/lib/api"
import { cn } from "@/lib/utils"
import type {
  PredictionMeta,
  PredictionReport,
} from "@/types/prediction"

type PredictPageProps = {
  prediction: PredictionReport | null
  onPredictionChange: (prediction: PredictionReport | null) => void
}

const presets: Array<{
  id: string
  label: string
  markers: string[]
}> = [
  {
    id: "carbapenemase",
    label: "Carbapenemase",
    markers: ["KPC", "NDM", "OXA-48"],
  },
  {
    id: "esbl",
    label: "ESBL",
    markers: ["CTX-M", "SHV", "TEM"],
  },
  {
    id: "quinolone",
    label: "Quinolone markers",
    markers: ["gyrA", "parC", "oqxA", "oqxB"],
  },
]

function toDetectedFeatures(markers: string[]): Record<string, boolean> {
  return Object.fromEntries(
    markers.map((marker) => [`gene:${marker}`, true] as const)
  )
}

export function PredictPage({
  prediction,
  onPredictionChange,
}: PredictPageProps) {
  const [meta, setMeta] = useState<PredictionMeta | null>(null)
  const [selected, setSelected] = useState<string[]>(["KPC", "NDM"])
  const [isLoadingMeta, setIsLoadingMeta] = useState(true)
  const [isPredicting, setIsPredicting] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [predictError, setPredictError] = useState<string | null>(null)
  const requestController = useRef<AbortController | null>(null)

  const availableMarkers = meta?.demo_markers ?? []

  const selectedSet = useMemo(() => new Set(selected), [selected])

  useEffect(() => {
    const controller = new AbortController()

    void fetchPredictMeta(controller.signal)
      .then((response) => {
        setMeta(response)
        setSelected((current) =>
          current.filter((marker) => response.demo_markers.includes(marker))
        )
        setMetaError(null)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setMetaError(
          error instanceof Error
            ? error.message
            : "Could not load model metadata."
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingMeta(false)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    return () => requestController.current?.abort()
  }, [])

  function toggleMarker(marker: string) {
    setSelected((current) =>
      current.includes(marker)
        ? current.filter((value) => value !== marker)
        : [...current, marker]
    )
  }

  function applyPreset(markers: string[]) {
    if (!meta) {
      return
    }
    setSelected(markers.filter((marker) => meta.demo_markers.includes(marker)))
  }

  async function handlePredict() {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setIsPredicting(true)
    setPredictError(null)
    onPredictionChange(null)

    try {
      const result = await predictAntibiotics(
        toDetectedFeatures(selected),
        meta?.supported_species ?? "Klebsiella pneumoniae",
        controller.signal
      )
      onPredictionChange(result)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      setPredictError(
        error instanceof Error ? error.message : "Prediction failed."
      )
    } finally {
      if (!controller.signal.aborted) {
        setIsPredicting(false)
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-5 md:p-8 lg:pt-10">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Predict
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Run Genome Firewall live
        </h1>
        <p className="text-sm text-muted-foreground">
          Select AMR markers, call the loaded{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            genome_firewall_models.pkl
          </code>
          , and review antibiotic-response predictions immediately.
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

      <Card className="rounded-lg shadow-none">
        <CardHeader className="border-b border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Model inputs</CardTitle>
              <CardDescription>
                Toggle presence/absence features for{" "}
                {meta?.supported_species ?? "Klebsiella pneumoniae"}.
              </CardDescription>
            </div>
            <Badge variant="outline">
              {meta ? `${meta.drugs.length} antibiotics` : "Loading model"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingMeta ? (
            <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Loading model metadata…
            </div>
          ) : null}

          {metaError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Model metadata unavailable</AlertTitle>
              <AlertDescription>{metaError}</AlertDescription>
            </Alert>
          ) : null}

          {meta ? (
            <>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-md"
                    onClick={() => applyPreset(preset.markers)}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-md"
                  onClick={() => setSelected([])}
                >
                  <Eraser aria-hidden="true" />
                  Clear
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {availableMarkers.map((marker) => {
                  const isSelected = selectedSet.has(marker)
                  return (
                    <button
                      key={marker}
                      type="button"
                      onClick={() => toggleMarker(marker)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                      aria-pressed={isSelected}
                    >
                      {marker}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  {selected.length === 0
                    ? "No markers selected — useful for a wild-type / empty-feature run."
                    : `${selected.length} markers selected: ${selected.join(", ")}`}
                </p>
                <Button
                  type="button"
                  disabled={isPredicting || !meta}
                  onClick={() => void handlePredict()}
                  className="rounded-md"
                >
                  {isPredicting ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <FlaskConical aria-hidden="true" />
                  )}
                  {isPredicting ? "Running model" : "Run prediction"}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {predictError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Prediction could not complete</AlertTitle>
          <AlertDescription>{predictError}</AlertDescription>
        </Alert>
      ) : null}

      {isPredicting && !prediction ? (
        <Card className="rounded-lg shadow-none">
          <CardContent className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Scoring five antibiotic models from the pickle artifact…
          </CardContent>
        </Card>
      ) : null}

      {prediction ? <PredictionResults prediction={prediction} /> : null}
    </div>
  )
}
