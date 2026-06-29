import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { QRCodeDisplay } from "@/components/ui/qrcode";
import { useToast } from "@/hooks/use-toast";

export interface KioskModeCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  kioskCode?: string;
  urlPath: string;
  qrFilename: string;
  enableLabel: string;
  enableDescription: string;
  urlLabel: string;
  qrLabel: string;
  copySuccessMessage: string;
  saving?: boolean;
  onSave: () => void;
}

export function KioskModeCard({
  title,
  description,
  enabled,
  onToggle,
  kioskCode,
  urlPath,
  qrFilename,
  urlLabel,
  qrLabel,
  copySuccessMessage,
  saving: _saving = false,
  onSave: _onSave,
}: KioskModeCardProps) {
  const { toast } = useToast();

  const kioskUrl = kioskCode ? `${window.location.origin}/kiosk/${kioskCode}${urlPath}` : "";

  const handleCopy = () => {
    if (!kioskUrl) return;
    navigator.clipboard.writeText(kioskUrl);
    toast({ title: "Copied!", description: copySuccessMessage });
  };

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-none">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        </div>
        <Switch
          checked={!!enabled}
          onCheckedChange={onToggle}
          className="shrink-0"
        />
      </div>

      {enabled && (
        <div className="mt-3 space-y-3">
          {kioskCode ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1.5 min-w-0">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{urlLabel}</Label>
                <div className="flex gap-1.5">
                  <Input
                    readOnly
                    value={kioskUrl}
                    className="font-mono text-xs bg-muted h-8 min-w-0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 shrink-0"
                    onClick={handleCopy}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 shrink-0">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{qrLabel}</Label>
                <QRCodeDisplay
                  value={kioskUrl}
                  filename={qrFilename}
                  size={80}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Save settings to generate the kiosk URL.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
