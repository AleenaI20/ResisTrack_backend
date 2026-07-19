import { useState } from "react"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LibraryPage } from "@/pages/library-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { PhylogenyPage } from "@/pages/phylogeny-page"
import type { AppSection } from "@/types/navigation"
import type { CohortGenome } from "@/types/genome"
import type { PhylogenyBuildResponse } from "@/types/phylogeny"
import type { PredictionReport } from "@/types/prediction"

type WorkflowStep = "dashboard" | "phylogeny"

export default function App() {
  const [currentSection, setCurrentSection] =
    useState<AppSection>("workbench")

  const [workflowStep, setWorkflowStep] =
    useState<WorkflowStep>("dashboard")

  const [cohort, setCohort] = useState<CohortGenome[]>([])

  const [phylogeny, setPhylogeny] =
    useState<PhylogenyBuildResponse | null>(null)

  const [predictionReport] =
    useState<PredictionReport | null>(null)

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          currentSection={currentSection}
          onNavigate={setCurrentSection}
        />

        <SidebarInset className="!w-0 min-w-0 overflow-hidden">
          <AppHeader />

          <main className="flex-1 overflow-auto">
            {currentSection !== "workbench" ? (
              <LibraryPage
                section={currentSection}
                cohort={cohort}
                analysis={null}
                phylogeny={phylogeny}
                prediction={predictionReport}
                onOpenWorkbench={() => setCurrentSection("workbench")}
              />
            ) : workflowStep === "dashboard" ? (
              <DashboardPage
                cohort={cohort}
                onCohortChange={setCohort}
                onContinue={() => {
                  setPhylogeny(null)
                  setWorkflowStep("phylogeny")
                }}
              />
            ) : (
              <PhylogenyPage
                cohort={cohort}
                primaryGenomeId={
                  cohort.find((genome) => genome.isPrimary)?.id ??
                  cohort[0]?.id ??
                  ""
                }
                result={phylogeny}
                onResultChange={setPhylogeny}
                onBack={() => setWorkflowStep("dashboard")}
                onContinue={() => setCurrentSection("workbench")}
              />
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
