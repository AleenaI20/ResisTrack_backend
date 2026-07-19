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
  getGenomeDetail,
  getGenomeLabel,
  getPrimaryGenome,
} from "@/lib/genome-label"
import type { AmrFinderAnalysis } from "@/types/analysis"
import type { CohortGenome } from "@/types/genome"
import type { AppSection } from "@/types/navigation"
import type { PhylogenyBuildResponse } from "@/types/phylogeny"

type LibrarySection = Exclude<AppSection, "workbench">

type LibraryPageProps = {
  section: LibrarySection
  cohort: CohortGenome[]
  analysis: AmrFinderAnalysis | null
  phylogeny: PhylogenyBuildResponse | null
  onOpenWorkbench: () => void
}

const sectionDetails: Record<
  LibrarySection,
  { label: string; title: string; description: string }
> = {
  genomes: {
    label: "Data",
    title: "Genomes",
    description: "Genome inputs available to the current workspace.",
  },
  markers: {
    label: "Data",
    title: "Markers",
    description: "Resistance genes and DNA changes detected during analysis.",
  },
  datasets: {
    label: "Data",
    title: "Datasets",
    description: "Manage the data sources used by this workspace.",
  },
  benchmarks: {
    label: "Data",
    title: "Benchmarks",
    description: "Track evaluation runs and model-quality measurements.",
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
  onOpenWorkbench,
}: LibraryPageProps) {
  const primary = getPrimaryGenome(cohort)

  if (section === "genomes") {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Cohort genomes"
            value={String(cohort.length)}
            detail="Current workspace"
          />
          <MetricCard
            label="Primary genome"
            value={
              primary
                ? primary.genome.source === "ncbi"
                  ? "NCBI"
                  : "Local"
                : "—"
            }
            detail={primary ? getGenomeLabel(primary.genome) : "Not selected"}
          />
          <MetricCard
            label="Phylogeny"
            value={phylogeny ? "Ready" : cohort.length >= 2 ? "Pending" : "Waiting"}
            detail={
              phylogeny
                ? `${phylogeny.genome_count} genomes in tree`
                : "Needs review step"
            }
          />
        </div>
        {cohort.length > 0 ? (
          <Card className="rounded-lg shadow-none">
            <CardHeader className="border-b border-border/70">
              <CardTitle>Workspace cohort</CardTitle>
              <CardDescription>
                Genomes currently selected for AMR and phylogeny.
              </CardDescription>
              <CardAction>
                <Badge variant="outline">Ready</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {cohort.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Dna
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {getGenomeLabel(entry.genome)}
                        </p>
                        {entry.isPrimary ? (
                          <Badge variant="secondary">Primary</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getGenomeDetail(entry.genome)} · {entry.id}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenWorkbench}
                className="rounded-md"
              >
                Open workbench
              </Button>
            </CardContent>
          </Card>
        ) : (
          <EmptyCollection
            icon={Dna}
            title="No genomes selected"
            description="Search NCBI or upload FASTA files to build a cohort of at least two genomes."
            actionLabel="Open workbench"
            onAction={onOpenWorkbench}
          />
        )}
      </>
    )
  }

  if (section === "datasets") {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Data sources"
            value="2"
            detail="NCBI and local FASTA"
          />
          <MetricCard
            label="Saved datasets"
            value="0"
            detail="No persistent datasets"
          />
          <MetricCard
            label="Workspace genomes"
            value={String(cohort.length)}
            detail="Current session"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SourceCard
            icon={Database}
            title="NCBI Nucleotide"
            description="Search complete genomic records through NCBI E-utilities."
            status="Connected"
          />
          <SourceCard
            icon={Dna}
            title="Local FASTA"
            description="Use quality-checked assembled bacterial genomes from this device."
            status="Available"
          />
        </div>
      </>
    )
  }

  if (section === "markers" && analysis) {
    const featureNames = Object.keys(analysis.detected_features)
    const geneCount = featureNames.filter((name) =>
      name.startsWith("gene:")
    ).length
    const mutationCount = featureNames.filter((name) =>
      name.startsWith("mutation:")
    ).length

    return (
      <>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="AMRFinderPlus findings"
            value={String(analysis.finding_count)}
            detail={`${analysis.predicted_protein_count.toLocaleString()} proteins analyzed`}
          />
          <MetricCard
            label="Detected genes"
            value={String(geneCount)}
            detail="Positive features"
          />
          <MetricCard
            label="DNA changes"
            value={String(mutationCount)}
            detail="Curated mutations"
          />
        </div>
        <Card className="rounded-lg shadow-none">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Detected features</CardTitle>
            <CardDescription>
              Positive AMR features produced from the primary genome.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">AMRFinderPlus</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {featureNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {featureNames.map((feature) => (
                  <Badge key={feature} variant="secondary">
                    {feature}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No AMR genes or curated resistance mutations were reported.
              </p>
            )}
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

function SourceCard({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: typeof Dna
  title: string
  description: string
  status: string
}) {
  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader>
        <span className="mb-2 flex size-8 items-center justify-center rounded-md border border-border bg-muted/40">
          <Icon className="size-4 text-primary" aria-hidden="true" />
        </span>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Badge variant="outline">{status}</Badge>
        </CardAction>
      </CardHeader>
    </Card>
  )
}
