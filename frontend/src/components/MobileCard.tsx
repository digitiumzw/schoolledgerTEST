import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface MobileCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * MobileCard Component
 * 
 * A reusable card component optimized for displaying table data on mobile devices.
 * This component provides a clean, touch-friendly interface for viewing data
 * that would normally be displayed in a table on desktop.
 */
export function MobileCard({ children, className = "", onClick }: MobileCardProps) {
  return (
    <Card className={`mb-3 ${className}`} onClick={onClick}>
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  );
}
