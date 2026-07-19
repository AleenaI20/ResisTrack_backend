import type { PhylogenyTreeNode } from "@/types/phylogeny"

export type LaidOutNode = {
  id: string
  name: string | null
  isLeaf: boolean
  x: number
  y: number
  parentX: number
  parentY: number
  branchLength: number
}

type MeasuredNode = {
  node: PhylogenyTreeNode
  depthUnits: number
  children: MeasuredNode[]
}

function measureNode(
  node: PhylogenyTreeNode,
  depthUnits = 0
): MeasuredNode {
  return {
    node,
    depthUnits,
    children: node.children.map((child) =>
      measureNode(
        child,
        depthUnits + Math.max(child.branch_length ?? 0, 0.05)
      )
    ),
  }
}

export function layoutPhylogenyTree(
  tree: PhylogenyTreeNode,
  options?: { rowHeight?: number; xScale?: number }
): {
  nodes: LaidOutNode[]
  width: number
  height: number
  maxDepth: number
} {
  const rowHeight = options?.rowHeight ?? 36
  const xScale = options?.xScale ?? 220
  const measured = measureNode(tree)
  const leafIndex = { index: 0 }
  const idCounter = { value: 1 }

  function place(
    measuredNode: MeasuredNode
  ): { node: LaidOutNode; descendants: LaidOutNode[] } {
    const localId = measuredNode.node.name ?? `inner-${idCounter.value++}`
    const x = measuredNode.depthUnits * xScale
    const childResults = measuredNode.children.map((child) => place(child))

    let y: number
    if (childResults.length === 0) {
      y = leafIndex.index * rowHeight
      leafIndex.index += 1
    } else {
      const childYs = childResults.map((result) => result.node.y)
      y = (Math.min(...childYs) + Math.max(...childYs)) / 2
    }

    const node: LaidOutNode = {
      id: localId,
      name: measuredNode.node.name,
      isLeaf: childResults.length === 0,
      x,
      y,
      parentX: x,
      parentY: y,
      branchLength: measuredNode.node.branch_length ?? 0,
    }

    const descendants: LaidOutNode[] = []
    for (const child of childResults) {
      child.node.parentX = x
      child.node.parentY = y
      descendants.push(child.node, ...child.descendants)
    }

    return { node, descendants }
  }

  const rootResult = place(measured)
  const nodes = [rootResult.node, ...rootResult.descendants]
  const maxDepth = Math.max(...nodes.map((node) => node.x), 0)
  const height = Math.max(leafIndex.index, 1) * rowHeight

  return {
    nodes,
    width: maxDepth + 180,
    height: height + 24,
    maxDepth,
  }
}

export function nearestNeighbor(
  genomeId: string,
  distanceMatrix: Array<{
    genome_id: string
    distances: Record<string, number>
  }>
): { genomeId: string; distance: number } | null {
  const row = distanceMatrix.find((entry) => entry.genome_id === genomeId)
  if (!row) {
    return null
  }

  let best: { genomeId: string; distance: number } | null = null
  for (const [otherId, distance] of Object.entries(row.distances)) {
    if (otherId === genomeId) {
      continue
    }
    if (!best || distance < best.distance) {
      best = { genomeId: otherId, distance }
    }
  }
  return best
}
