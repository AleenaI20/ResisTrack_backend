export const WORKFLOW_STEPS = [
  "upload",
  "analyze",
  "review",
  "report",
] as const

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number]

export function workflowStepIndex(step: WorkflowStep): number {
  return WORKFLOW_STEPS.indexOf(step) + 1
}
