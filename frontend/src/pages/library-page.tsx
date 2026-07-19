import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock3,
  Database,
  Dna,
  FileText,
  FlaskConical,
  Microscope,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getGenomeLabel,
  getPrimaryGenome,
} from "@/lib/genome-label"
import {
  demoBenchmarks,
  demoDatasets,
  demoGenomes,
  demoMarkers,
} from "@/lib/mock-data"
import type { AmrFinderAnalysis } from "@/types/analysis"
import type { CohortGenome } from "@/types/genome"
import type { AppSection } from "@/types/navigation"
import type { PhylogenyBuildResponse } from "@/types/phylogeny"
import type { PredictionReport } from "@/types/prediction"

type LibrarySection = Exclude<AppSection, "workbench">

type LibraryPageProps = {
  section: LibrarySection
  cohort: CohortGenome[]
  analysis: AmrFinderAnalysis | null
  phylogeny: PhylogenyBuildResponse | null
  prediction: PredictionReport | null
  onOpenWorkbench: () => void
}

const sectionDetails: Record<
  LibrarySection,
  { label: string; title: string; description: string }
> = {
  genomes: {
    label: "Data",
    title: "Genomes",
    description: "Public K. pneumoniae references represented in the demo.",
  },
  markers: {
    label: "Data",
    title: "Markers",
    description: "AMR genes and DNA changes used as model features.",
  },
  datasets: {
    label: "Data",
    title: "Datasets",
    description: "Training, phenotype, feature, and grouped-holdout assets.",
  },
  benchmarks: {
    label: "Data",
    title: "Benchmarks",
    description: "Illustrative grouped-holdout model quality by antibiotic.",
  },
  predictions: {
    label: "Analysis",
    title: "Predictions",
    description: "Review antibiotic-response predictions from completed runs.",
  },
  reports: {
    label: "Analysis",
    title: "Reports",
    description: "Generated analysis reports and supporting evidence.",
  },
  history: {
    label: "Analysis",
    title: "History",
    description: "Activity recorded during the current workspace session.",
  },
}

const sectionIcons = {
  genomes: Dna,
  markers: Microscope,
  datasets: Database,
  benchmarks: BarChart3,
  predictions: FlaskConical,
  reports: FileText,
  history: Clock3,
} satisfies Record<LibrarySection, typeof Dna>

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <Card className="rounded-lg shadow-none">
      <CardContent className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-semibold tracking-tight">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function AlertDemoNotice() {
  return (
    <div
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
    >
      <p className="font-medium">Illustrative benchmark data</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
        These values populate the hackathon interface and are not validated
        measurements from the current pickle artifact. Replace them with held-out
        evaluation results before presenting model performance as evidence.
      </p>
    </div>
  )
}

function EmptyCollection({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: typeof Dna
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <Card className="rounded-lg shadow-none">
      <CardContent className="flex min-h-52 flex-col items-center justify-center text-center">
        <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-medium">{title}</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
        {actionLabel && onAction ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAction}
            className="mt-4 rounded-md"
          >
            {actionLabel}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function LibraryPage({
  section,
  cohort,
  analysis,
  phylogeny,
  prediction,
  onOpenWorkbench,
}: LibraryPageProps) {
  const details = sectionDetails[section]
  const SectionIcon = sectionIcons[section]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-5 md:p-8 lg:pt-10">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <SectionIcon className="size-4 text-primary" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {details.label}
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {details.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {details.description}
          </p>
        </div>
      </div>

      <SectionContent
        section={section}
        cohort={cohort}
        analysis={analysis}
        phylogeny={phylogeny}
        prediction={prediction}
        onOpenWorkbench={onOpenWorkbench}
      />
    </div>
  )
}

function SectionContent({
  section,
  cohort,
  analysis,
  phylogeny,
  prediction,
  onOpenWorkbench,
}: LibraryPageProps) {
  const primary = getPrimaryGenome(cohort)

  if (section === "genomes") {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Reference genomes"
            value={String(demoGenomes.length)}
            detail="K. pneumoniae demo cohort"
          />
          <MetricCard
            label="Sequence types"
            value={String(new Set(demoGenomes.map((item) => item.lineage)).size)}
            detail="Genomically distinct lineages"
          />
          <MetricCard
            label="Model species"
            value="1"
            detail="Klebsiella pneumoniae"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {demoGenomes.map((genome) => (
            <Card key={genome.accession} className="rounded-lg shadow-none">
              <CardHeader className="border-b border-border/70">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                    <Dna className="size-4 text-primary" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="truncate">{genome.strain}</CardTitle>
                    <CardDescription>{genome.accession}</CardDescription>
                  </div>
                </div>
                <CardAction>
                  <Badge variant="outline">{genome.lineage}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium italic">{genome.organism}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {genome.length} · {genome.source}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {genome.markers.map((marker) => (
                    <Badge key={marker} variant="secondary">
                      {marker}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Demo catalog using public K. pneumoniae reference accessions. Marker
          badges are illustrative inputs for the live model panel.
        </p>
      </>
    )
  }

  if (section === "datasets") {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Data sources"
            value="3"
            detail="BV-BRC, NCBI, Resistrace"
          />
          <MetricCard
            label="Training genomes"
            value="1,248"
            detail="K. pneumoniae"
          />
          <MetricCard
            label="Model features"
            value="231"
            detail="Gene presence / absence"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {demoDatasets.map((dataset) => (
            <Card key={dataset.name} className="rounded-lg shadow-none">
              <CardHeader>
                <span className="mb-2 flex size-8 items-center justify-center rounded-md border border-border bg-muted/40">
                  <Database
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                </span>
                <CardTitle>{dataset.name}</CardTitle>
                <CardDescription>{dataset.detail}</CardDescription>
                <CardAction>
                  <Badge variant="outline">{dataset.status}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 border-t border-border/70">
                <p className="text-xs text-muted-foreground">
                  {dataset.source}
                </p>
                <p className="text-xs font-medium">{dataset.records}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Demo dataset metadata for presentation. The deployed pickle contains
          the fitted models and feature schema, not these source records.
        </p>
      </>
    )
  }

  if (section === "markers") {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Catalog markers"
            value="231"
            detail="Features in the pickle"
          />
          <MetricCard
            label="Featured markers"
            value={String(demoMarkers.length)}
            detail="Demo evidence cards"
          />
          <MetricCard
            label="Evidence types"
            value="3"
            detail="Known, curated, statistical"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {demoMarkers.map((marker) => (
            <Card key={marker.name} className="rounded-lg shadow-none">
              <CardHeader className="border-b border-border/70">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                    <Microscope
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <CardTitle>{marker.name}</CardTitle>
                    <CardDescription>{marker.category}</CardDescription>
                  </div>
                </div>
                <CardAction>
                  <Badge variant="outline">{marker.drugClass}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">{marker.evidence}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Present in {marker.genomes} demo genomes
                  </p>
                </div>
                <Badge variant="secondary">Model feature</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenWorkbench}
          className="w-fit rounded-md"
        >
          Test markers in live model
          <ArrowRight aria-hidden="true" />
        </Button>
      </>
    )
  }

  if (section === "benchmarks") {
    return (
      <>
        <AlertDemoNotice />
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Evaluated drugs"
            value="5"
            detail="Per-drug logistic models"
          />
          <MetricCard
            label="Grouped split"
            value="114"
            detail="Genomic clades"
          />
          <MetricCard
            label="Best demo AUROC"
            value="0.94"
            detail="Illustrative only"
          />
        </div>
        <Card className="overflow-hidden rounded-lg shadow-none">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Per-antibiotic model quality</CardTitle>
            <CardDescription>
              Grouped-holdout metrics formatted for the HackNation demo.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">Illustrative</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Drug</th>
                    <th className="px-4 py-3 font-medium">
                      Balanced accuracy
                    </th>
                    <th className="px-4 py-3 font-medium">
                      Resistant recall
                    </th>
                    <th className="px-4 py-3 font-medium">AUROC</th>
                    <th className="px-4 py-3 font-medium">No-call rate</th>
                    <th className="px-4 py-3 font-medium">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {demoBenchmarks.map((item) => (
                    <tr
                      key={item.drug}
                      className="border-b border-border/70 last:border-b-0"
                    >
                      <td className="px-4 py-4 text-sm font-medium">
                        {item.drug}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {item.balancedAccuracy}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {item.resistantRecall}
                      </td>
                      <td className="px-4 py-4 text-sm">{item.auroc}</td>
                      <td className="px-4 py-4 text-sm">
                        {item.noCallRate}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline">{item.tier}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  if (
    (section === "predictions" || section === "reports") &&
    prediction
  ) {
    const noCalls = prediction.predictions.filter(
      (item) => item.call === "no_call"
    ).length
    const failCalls = prediction.predictions.filter(
      (item) => item.call === "likely_to_fail"
    ).length

    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Antibiotics"
            value={String(prediction.predictions.length)}
            detail={prediction.supported_species}
          />
          <MetricCard
            label="Likely to fail"
            value={String(failCalls)}
            detail="Model calls"
          />
          <MetricCard
            label="No-calls"
            value={String(noCalls)}
            detail="Uncertain or unsupported"
          />
        </div>
        <Card className="rounded-lg shadow-none">
          <CardHeader className="border-b border-border/70">
            <CardTitle>
              {section === "reports"
                ? "Current decision report"
                : "Current predictions"}
            </CardTitle>
            <CardDescription>
              Research prototype — confirm every result with standard
              laboratory testing.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">Session only</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {prediction.predictions.map((item) => (
              <div
                key={item.drug}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.drug
                      .split("/")
                      .map(
                        (part) =>
                          part.charAt(0).toUpperCase() + part.slice(1)
                      )
                      .join(" / ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(item.confidence * 100)}% model score ·{" "}
                    {item.model_tier} tier
                  </p>
                </div>
                <Badge variant="secondary">
                  {item.call === "likely_to_fail"
                    ? "Likely to fail"
                    : item.call === "likely_to_work"
                      ? "Likely to work"
                      : "No-call"}
                </Badge>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenWorkbench}
              className="rounded-md"
            >
              Open report
              <ArrowRight aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const emptyStates: Record<
    Exclude<LibrarySection, "genomes" | "datasets">,
    { metrics: [string, string, string]; title: string; description: string }
  > = {
    markers: {
      metrics: ["Resistance genes", "DNA changes", "Model features"],
      title: "No markers detected yet",
      description:
        "Run the Genome Reader to identify AMR genes and mutations before features can be created.",
    },
    benchmarks: {
      metrics: ["Benchmark runs", "Evaluated genomes", "Model metrics"],
      title: "No benchmark results",
      description:
        "Benchmark measurements will appear after a model and evaluation dataset are configured.",
    },
    predictions: {
      metrics: ["Predictions", "Completed", "No-calls"],
      title: "No predictions available",
      description:
        "Predictions require Genome Reader features and a compatible species-specific model.",
    },
    reports: {
      metrics: ["Reports", "Ready to export", "Archived"],
      title: "No reports generated",
      description:
        "A report can be generated after antibiotic-response predictions have been reviewed.",
    },
    history: {
      metrics: ["Recorded events", "Completed runs", "Generated reports"],
      title: "No analysis history",
      description:
        "Completed analyses and report activity will be recorded here.",
    },
  }
  const state = emptyStates[section]
  const values =
    section === "history" && cohort.length > 0
      ? [String(cohort.length), analysis ? "1" : "0", phylogeny ? "1" : "0"]
      : ["—", "—", "—"]

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {state.metrics.map((metric, index) => (
          <MetricCard
            key={metric}
            label={metric}
            value={values[index]}
            detail={
              section === "history" && index === 0 && cohort.length > 0
                ? "Genomes selected this session"
                : "Not available yet"
            }
          />
        ))}
      </div>
      {section === "history" && cohort.length > 0 ? (
        <Card className="rounded-lg shadow-none">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Current session</CardTitle>
            <CardDescription>
              Activity not yet persisted beyond this browser session.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-start gap-3">
            <Activity
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">Cohort selected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cohort.length} genomes
                {primary
                  ? ` · primary ${getGenomeLabel(primary.genome)}`
                  : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyCollection
          icon={sectionIcons[section]}
          title={state.title}
          description={state.description}
          actionLabel={cohort.length > 0 ? "Open workbench" : undefined}
          onAction={cohort.length > 0 ? onOpenWorkbench : undefined}
        />
      )}
    </>
  )
}
