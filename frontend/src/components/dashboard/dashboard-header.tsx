export function DashboardHeader() {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Dashboard
      </p>
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
        Build a genome cohort
      </h1>
      <p className="text-sm text-muted-foreground">
        Select at least two quality-checked reconstructed bacterial genomes for
        AMR analysis and phylogeny.
      </p>
    </div>
  )
}
