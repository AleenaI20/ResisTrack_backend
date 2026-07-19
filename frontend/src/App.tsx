import { useState } from "react"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AnalyzePage } from "@/pages/analyze-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { LibraryPage } from "@/pages/library-page"
import { PhylogenyPage } from "@/pages/phylogeny-page"
import type { AmrFinderAnalysis } from "@/types/analysis"
import type { CohortGenome } from "@/types/genome"
import { MIN_COHORT_SIZE } from "@/types/genome"
import type { AppSection } from "@/types/navigation"
import type { PhylogenyBuildResponse } from "@/types/phylogeny"
import type { WorkflowStep } from "@/types/workflow"
import { getPrimaryGenome } from "@/lib/genome-label"

export default function App() {
  const [cohort, setCohort] = useState<CohortGenome[]>([])
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("upload")
  const [currentSection, setCurrentSection] =
    useState<AppSection>("workbench")
  const [amrAnalysis, setAmrAnalysis] =
    useState<AmrFinderAnalysis | null>(null)
  const [phylogenyResult, setPhylogenyResult] =
    useState<PhylogenyBuildResponse | null>(null)

  const primary = getPrimaryGenome(cohort)

  function handleCohortChange(next: CohortGenome[]) {
    const previousPrimaryId = primary?.id ?? null
    const nextPrimary = getPrimaryGenome(next)
    setCohort(next)
    setPhylogenyResult(null)

    if (!nextPrimary || next.length < MIN_COHORT_SIZE) {
      setCurrentStep("upload")
    }

    if (nextPrimary?.id !== previousPrimaryId) {
      setAmrAnalysis(null)
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          currentSection={currentSection}
          onNavigate={setCurrentSection}
        />
        <SidebarInset className="!w-0 min-w-0 overflow-hidden">
          <AppHeader currentStep={currentStep} />
          <main className="flex-1 overflow-auto">
            {currentSection !== "workbench" ? (
              <LibraryPage
                section={currentSection}
                cohort={cohort}
                analysis={amrAnalysis}
                phylogeny={phylogenyResult}
                onOpenWorkbench={() => setCurrentSection("workbench")}
              />
            ) : currentStep === "upload" ||
              !primary ||
              cohort.length < MIN_COHORT_SIZE ? (
              <DashboardPage
                cohort={cohort}
                onCohortChange={handleCohortChange}
                onContinue={() => setCurrentStep("analyze")}
              />
            ) : currentStep === "review" ? (
              <PhylogenyPage
                cohort={cohort}
                primaryGenomeId={primary.id}
                result={phylogenyResult}
                onResultChange={setPhylogenyResult}
                onBack={() => setCurrentStep("analyze")}
              />
            ) : (
              <AnalyzePage
                primary={primary}
                cohortSize={cohort.length}
                analysis={amrAnalysis}
                onAnalysisChange={setAmrAnalysis}
                onBack={() => setCurrentStep("upload")}
                onContinue={() => setCurrentStep("review")}
              />
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
