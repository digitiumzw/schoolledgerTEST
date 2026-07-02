import { useState, useEffect } from "react";
import { api } from "@/api/api";
import { TransportVehicle, TransportDriver, TransportRoutePeriod } from "@/types/dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  routeId: string;
  period?: TransportRoutePeriod | null;
}

export function RoutePeriodModal({ open, onOpenChange, onSuccess, routeId, period }: Props) {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [drivers, setDrivers] = useState<TransportDriver[]>([]);
  const [form, setForm] = useState({ vehicleId: "", driverId: "" });

  useEffect(() => {
    if (!open) return;

    if (period) {
      setForm({
        vehicleId: period.vehicleId,
        driverId: period.driverId ?? "",
      });
    } else {
      setForm({ vehicleId: "", driverId: "" });
    }

    Promise.all([api.getVehicles(), api.getDrivers()])
      .then(([v, d]) => { setVehicles(v?.data ?? []); setDrivers(d?.data ?? []); })
      .catch(() => {});
  }, [open, period]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId) { toast.error("Vehicle is required"); return; }

    try {
      setLoading(true);
      const data = {
        vehicleId: form.vehicleId,
        // Send null (not undefined) when no driver is selected so the
        // backend can distinguish "remove driver" from "no change" via
        // array_key_exists.  undefined is omitted by JSON.stringify and
        // would leave the old driver_id untouched on update.
        driverId: form.driverId || null,
      };
      if (period) {
        await api.updateRoutePeriod(period.id, data);
        toast.success("Assignment updated");
      } else {
        await api.createRoutePeriod(routeId, data);
        toast.success("Vehicle & driver assigned to route");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save assignment");
    } finally {
      setLoading(false);
    }
  };

  const selectedVehicle = vehicles.find(v => v.id === form.vehicleId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{period ? "Edit Vehicle & Driver Assignment" : "Assign Vehicle & Driver"}</DialogTitle>
          <DialogDescription>
            Link a vehicle and driver to this route. This does not affect student allocations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle *</Label>
            <Select value={form.vehicleId || "_none"} onValueChange={v => setForm({ ...form, vehicleId: v === "_none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Select —</SelectItem>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} {v.regNumber ? `(${v.regNumber})` : ""} — cap. {v.capacity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVehicle && (
              <p className="text-xs text-muted-foreground">
                Capacity: {selectedVehicle.capacity} students
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select value={form.driverId || "none"} onValueChange={v => setForm({ ...form, driverId: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Select driver…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {drivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} {d.phone ? `· ${d.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {period ? "Update" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
