import { useCallback, useId, useRef, useState } from "react"
import {
  FileWarning,
  UploadCloud,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { isFastaFilename } from "@/lib/format"
import { genomeIdentityKey } from "@/lib/genome-label"
import { cn } from "@/lib/utils"
import type { CohortGenome, GenomeSelection } from "@/types/genome"
import { MAX_COHORT_SIZE } from "@/types/genome"

type FastaUploadPanelProps = {
  cohort: CohortGenome[]
  onAddGenome: (genome: GenomeSelection) => void
}

export function FastaUploadPanel({
  cohort,
  onAddGenome,
}: FastaUploadPanelProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isFull = cohort.length >= MAX_COHORT_SIZE

  const applyFile = useCallback(
    (next: File | null) => {
      if (!next) {
        setError(null)
        return
      }

      if (!isFastaFilename(next.name)) {
        setError("Select a reconstructed genome file ending in .fasta, .fa, or .fna.")
        return
      }

      if (cohort.length >= MAX_COHORT_SIZE) {
        setError(`Cohort is limited to ${MAX_COHORT_SIZE} genomes.`)
        return
      }

      const genome: GenomeSelection = { source: "local", file: next }
      const selectedKeys = new Set(
        cohort.map((entry) => genomeIdentityKey(entry.genome))
      )
      if (selectedKeys.has(genomeIdentityKey(genome))) {
        setError("That FASTA file is already in the cohort.")
        return
      }

      setError(null)
      onAddGenome(genome)
    },
    [cohort, onAddGenome]
  )

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const selected = files?.[0] ?? null
      applyFile(selected)
    },
    [applyFile]
  )

  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Upload genome</CardTitle>
        <CardDescription>
          Add FASTA, FA, or FNA files to the cohort.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            setIsDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            handleFiles(event.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-9 text-center transition-colors",
            isDragging
              ? "border-primary bg-accent/80"
              : "border-border bg-muted/40 hover:border-primary/50 hover:bg-accent/40",
            error ? "border-destructive/50" : null
          )}
          aria-controls={inputId}
          aria-label="Select or drop a FASTA genome file"
        >
          <div className="flex size-10 items-center justify-center rounded-md bg-card ring-1 ring-border">
            <UploadCloud className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Drop a FASTA file here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Accepted formats: .fasta, .fa, .fna
            </p>
          </div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".fasta,.fa,.fna,text/plain"
            className="sr-only"
            onChange={(event) => {
              handleFiles(event.target.files)
              event.target.value = ""
            }}
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Files remain local until analysis begins.
        </p>
        <Button
          type="button"
          variant="outline"
          className="rounded-md"
          disabled={isFull}
          onClick={() => inputRef.current?.click()}
        >
          Add FASTA
        </Button>
      </CardFooter>
    </Card>
  )
}
