import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/api";
import { TransportStop } from "@/types/dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, GripVertical, Clock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId: string;
  routeName: string;
  onChange?: () => void;
}

export function StopsManagerModal({ open, onOpenChange, routeId, routeName, onChange }: Props) {
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    api.getRouteStops(routeId)
      .then(data => setStops(data ?? []))
      .catch(() => toast.error("Failed to load stops"))
      .finally(() => setLoading(false));
  }, [routeId]);

  useEffect(() => {
    if (open) { reload(); setNewName(""); setNewTime(""); }
  }, [open, routeId, reload]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) { toast.error("Stop name is required"); return; }
    setSaving(true);
    try {
      await api.createStop(routeId, { name, pickupTime: newTime || undefined });
      toast.success("Stop added");
      setNewName(""); setNewTime("");
      reload();
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add stop");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stopId: string, name: string) => {
    if (!confirm(`Remove stop "${name}"? Students assigned to it will have their stop cleared.`)) return;
    try {
      await api.deleteStop(stopId);
      toast.success("Stop removed");
      reload();
      onChange?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove stop");
    }
  };

  const handleUpdateTime = async (stop: TransportStop, time: string) => {
    try {
      await api.updateStop(stop.id, { pickupTime: time || undefined });
      reload();
      onChange?.();
    } catch {
      toast.error("Failed to update stop time");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Stops — {routeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading stops…
            </div>
          ) : stops.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No stops yet. Add the first stop below.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stops.map((stop, idx) => (
                <div key={stop.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="w-5 text-xs text-muted-foreground">{idx + 1}.</span>
                  <span className="flex-1 font-medium text-sm">{stop.name}</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <Input
                      type="time"
                      className="h-7 w-24 text-xs"
                      value={stop.pickupTime ?? ""}
                      onChange={e => handleUpdateTime(stop, e.target.value)}
                      onBlur={e => handleUpdateTime(stop, e.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(stop.id, stop.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Add Stop</p>
            <div className="flex gap-2">
              <Input
                placeholder="Stop name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                className="flex-1"
              />
              <Input
                type="time"
                className="w-28"
                value={newTime}
                onChange={e => setNewTime(e.target.value)}
                placeholder="Time"
              />
              <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !newName.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
