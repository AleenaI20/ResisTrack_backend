import { useMemo, useState } from "react"
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { layoutPhylogenyTree } from "@/lib/phylogeny-layout"
import { cn } from "@/lib/utils"
import type { PhylogenyBuildResponse } from "@/types/phylogeny"

const CLADE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#4f46e5",
  "#059669",
  "#b91c1c",
  "#7c3aed",
  "#0284c7",
  "#65a30d",
  "#c2410c",
  "#be185d",
  "#0f766e",
  "#4338ca",
  "#15803d",
  "#b45309",
]

type PhylogenyTreeProps = {
  result: PhylogenyBuildResponse
  primaryGenomeId: string
  selectedGenomeId: string | null
  onSelectGenome: (genomeId: string) => void
}

export function PhylogenyTree({
  result,
  primaryGenomeId,
  selectedGenomeId,
  onSelectGenome,
}: PhylogenyTreeProps) {
  const [scale, setScale] = useState(1)
  const cladeById = useMemo(
    () =>
      new Map(
        result.clade_assignments.map((assignment) => [
          assignment.genome_id,
          assignment.clade_id,
        ])
      ),
    [result.clade_assignments]
  )

  const layout = useMemo(
    () => layoutPhylogenyTree(result.tree, { rowHeight: 48, xScale: 340 }),
    [result.tree]
  )

  const padding = 40
  const viewWidth = Math.max(layout.width + padding * 2, 480)
  const viewHeight = Math.max(layout.height + padding * 2, 220)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Midpoint-rooted neighbor-joining tree · clade colors from hierarchical
          clustering
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-md"
            onClick={() => setScale((value) => Math.max(0.6, value - 0.15))}
            aria-label="Zoom out"
          >
            <ZoomOut aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-md"
            onClick={() => setScale((value) => Math.min(2, value + 0.15))}
            aria-label="Zoom in"
          >
            <ZoomIn aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-md"
            onClick={() => setScale(1)}
            aria-label="Reset zoom"
          >
            <Maximize2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-border bg-muted/20">
        <div
          style={{
            width: viewWidth * scale,
            height: viewHeight * scale,
          }}
        >
          <svg
            role="img"
            aria-label="Phylogenetic tree"
            width={viewWidth * scale}
            height={viewHeight * scale}
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            className="block"
          >
            <g transform={`translate(${padding} ${padding})`}>
              {layout.nodes.map((node) => {
                if (node.x === node.parentX && node.y === node.parentY) {
                  return null
                }
                return (
                  <path
                    key={`edge-${node.id}`}
                    d={`M ${node.parentX} ${node.parentY} H ${node.x} V ${node.y}`}
                    fill="none"
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )
              })}

              {layout.nodes.map((node) => {
                if (!node.isLeaf || !node.name) {
                  return (
                    <circle
                      key={`node-${node.id}`}
                      cx={node.x}
                      cy={node.y}
                      r={4}
                      fill="white"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="text-muted-foreground/60"
                    />
                  )
                }

                const cladeId = cladeById.get(node.name) ?? 1
                const color =
                  CLADE_COLORS[(cladeId - 1) % CLADE_COLORS.length]
                const isPrimary = node.name === primaryGenomeId
                const isSelected = node.name === selectedGenomeId

                return (
                  <g key={`leaf-${node.id}`}>

                    {isPrimary && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={12}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={3}
                      />
                    )}

                    {isPrimary && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={15}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                    )}
                    
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isPrimary ? 9 : isSelected ? 7 : 5}
                      fill={color}
                      stroke={isSelected ? "currentColor" : "transparent"}
                      strokeWidth={2}
                      className={cn(
                        "cursor-pointer",
                        isSelected ? "text-foreground" : null
                      )}
                      onClick={() => onSelectGenome(node.name!)}
                    >
                      <title>
                        {`${node.name}
                      Clade ${cladeId}
                      ${isPrimary ? "Primary uploaded genome" : ""}
                      Branch length: ${node.branchLength.toFixed(4)}`}
                      </title>
                    </circle>
                    <text
                      x={node.x + 12}
                      y={node.y + 4}
                      className={cn(
                        "cursor-pointer fill-foreground text-[13px]",
                        isPrimary ? "font-bold" : "font-medium"
                      )}
                      onClick={() => onSelectGenome(node.name!)}
                    >
                      {node.name}
                      {isPrimary ? " ★" : ""}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">★ Primary Genome</Badge>
        <Badge variant="destructive">⭕ AMR Detected</Badge>
      
        {result.clade_assignments
          .reduce<number[]>((ids, assignment) => {
            if (!ids.includes(assignment.clade_id)) {
              ids.push(assignment.clade_id)
            }
            return ids
          }, [])
          .map((cladeId) => (
            <Badge key={cladeId} variant="outline">
              <span
                className="mr-1.5 inline-block size-2 rounded-full"
                style={{
                  backgroundColor:
                    CLADE_COLORS[(cladeId - 1) % CLADE_COLORS.length],
                }}
              />
              Clade {cladeId}
            </Badge>
          ))}
      </div>
    </div>
  )
}
