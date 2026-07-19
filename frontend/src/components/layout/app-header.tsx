import { FlaskConical } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="rounded-md" />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary bg-accent text-primary">
          <FlaskConical className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Live model prediction</p>
          <p className="truncate text-xs text-muted-foreground">
            genome_firewall_models.pkl
          </p>
        </div>
      </div>
    </header>
  )
}
