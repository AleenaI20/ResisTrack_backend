import { useState } from "react"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LibraryPage } from "@/pages/library-page"
import { PredictPage } from "@/pages/predict-page"
import type { AppSection } from "@/types/navigation"
import type { PredictionReport } from "@/types/prediction"

export default function App() {
  const [currentSection, setCurrentSection] =
    useState<AppSection>("workbench")
  const [predictionReport, setPredictionReport] =
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
                cohort={[]}
                analysis={null}
                phylogeny={null}
                prediction={predictionReport}
                onOpenWorkbench={() => setCurrentSection("workbench")}
              />
            ) : (
              <PredictPage
                prediction={predictionReport}
                onPredictionChange={setPredictionReport}
              />
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
