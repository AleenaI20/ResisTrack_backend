import { Check, Dna, FileText, ScanSearch, Upload } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import {
  WORKFLOW_STEPS,
  workflowStepIndex,
  type WorkflowStep,
} from "@/types/workflow"

const workflow = [
  { id: "upload", title: "Upload", icon: Upload },
  { id: "analyze", title: "Analyze", icon: Dna },
  { id: "review", title: "Review", icon: ScanSearch },
  { id: "report", title: "Report", icon: FileText },
] as const satisfies ReadonlyArray<{
  id: WorkflowStep
  title: string
  icon: typeof Upload
}>

type AppHeaderProps = {
  currentStep: WorkflowStep
}

export function AppHeader({ currentStep }: AppHeaderProps) {
  const currentStepNumber = workflowStepIndex(currentStep)

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="rounded-md" />
      <Separator orientation="vertical" className="h-6" />

      <nav
        className="mx-auto flex min-w-0 flex-1 items-center justify-center"
        aria-label="Analysis workflow"
      >
        <ol className="grid w-full max-w-xl grid-cols-4">
          {workflow.map((step, index) => {
            const stepNumber = index + 1
            const isComplete = stepNumber < currentStepNumber
            const isCurrent = step.id === currentStep

            return (
              <li
                key={step.id}
                aria-current={isCurrent ? "step" : undefined}
                className="relative flex min-w-0 justify-center"
              >
                {index < WORKFLOW_STEPS.length - 1 ? (
                  <span
                    className={cn(
                      "absolute top-3.5 left-1/2 h-px w-full",
                      isComplete ? "bg-primary" : "bg-border"
                    )}
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative z-10 flex min-w-0 items-center gap-2 bg-background px-2">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border",
                      isComplete &&
                        "border-primary bg-primary text-primary-foreground",
                      isCurrent && "border-primary bg-accent text-primary",
                      !isComplete &&
                        !isCurrent &&
                        "border-border bg-background text-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <step.icon className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "hidden truncate text-xs font-medium sm:block",
                      isCurrent || isComplete
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className="hidden w-8 shrink-0 md:block" aria-hidden="true" />
    </header>
  )
}
