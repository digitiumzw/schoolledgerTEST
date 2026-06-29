/**
 * SettingsCardSkeleton Component
 * 
 * Reusable loading skeleton for settings cards.
 * Replaces duplicate skeleton code across settings tab components.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SettingsCardSkeletonProps {
  rows?: number;
  showHeader?: boolean;
}

export function SettingsCardSkeleton({ rows = 3, showHeader = true }: SettingsCardSkeletonProps) {
  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
