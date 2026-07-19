import {
  BarChart3,
  Database,
  Dna,
  FileText,
  FlaskConical,
  History,
  Microscope,
  PanelsTopLeft,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import type { AppSection } from "@/types/navigation"

const navigation: Array<{
  label: string
  items: Array<{
    id: AppSection
    title: string
    icon: typeof PanelsTopLeft
  }>
}> = [
  {
    label: "Workspace",
    items: [
      {
        id: "workbench",
        title: "Workbench",
        icon: PanelsTopLeft,
      },
    ],
  },
  {
    label: "Data",
    items: [
      {
        id: "genomes",
        title: "Genomes",
        icon: Dna,
      },
      {
        id: "markers",
        title: "Markers",
        icon: Microscope,
      },
      {
        id: "datasets",
        title: "Datasets",
        icon: Database,
      },
      {
        id: "benchmarks",
        title: "Benchmarks",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Analysis",
    items: [
      {
        id: "predictions",
        title: "Predictions",
        icon: FlaskConical,
      },
      {
        id: "reports",
        title: "Reports",
        icon: FileText,
      },
      {
        id: "history",
        title: "History",
        icon: History,
      },
    ],
  },
]

type AppSidebarProps = {
  currentSection: AppSection
  onNavigate: (section: AppSection) => void
}

export function AppSidebar({
  currentSection,
  onNavigate,
}: AppSidebarProps) {
  const { setOpenMobile } = useSidebar()

  function handleNavigate(section: AppSection) {
    onNavigate(section)
    setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <img
            src="/image.png"
            alt="Resistrace"
            className="size-10 shrink-0 object-contain"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold tracking-tight">
              Resistrace
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Genome Firewall
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        {navigation.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={item.id === currentSection}
                      tooltip={item.title}
                      className="rounded-[6px]"
                      onClick={() => handleNavigate(item.id)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
