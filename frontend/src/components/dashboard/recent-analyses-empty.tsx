import { Inbox } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function RecentAnalysesEmpty() {
  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Recent analyses</CardTitle>
        <CardDescription>
          Completed antibiotic-response reports will list here after the backend
          can persist jobs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-card ring-1 ring-border">
            <Inbox className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No analyses yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              There is no history to display because the application is not
              connected to an analysis API and no sample records are loaded.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
