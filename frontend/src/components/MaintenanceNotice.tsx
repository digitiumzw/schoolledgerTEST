import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";

interface MaintenanceNoticeProps {
  headline: string;
  message: string;
}

export function MaintenanceNotice({ headline, message }: MaintenanceNoticeProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/40 shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Wrench className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{headline}</h1>
            <p className="text-muted-foreground leading-relaxed">{message}</p>
          </div>
          <p className="text-xs text-muted-foreground/60">
            SchoolLedger
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
