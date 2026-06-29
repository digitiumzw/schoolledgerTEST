import { useState, useEffect } from "react";
import { api } from "@/api/api";
import { TransportRoute, TransportVehicle, TransportDriver } from "@/types/dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const NONE = "__none__";

interface RouteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: "create" | "edit";
  route?: TransportRoute | null;
}

export function RouteFormModal({ open, onOpenChange, onSuccess, mode, route }: RouteFormModalProps) {
  const [loading, setLoading]   = useState(false);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [drivers, setDrivers]   = useState<TransportDriver[]>([]);
  const [formData, setFormData] = useState({ routeName: "", monthlyFee: 0, vehicleId: "", driverId: "" });

  useEffect(() => {
    if (!open) return;
    Promise.all([api.getVehicles(), api.getDrivers()])
      .then(([v, d]) => {
        setVehicles(((v?.data ?? []) as TransportVehicle[]).filter((x) => x.status === "active"));
        setDrivers(((d?.data ?? []) as TransportDriver[]).filter((x) => x.status === "active"));
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (mode === "edit" && route) {
      setFormData({
        routeName: route.routeName,
        monthlyFee: route.monthlyFee,
        vehicleId: route.vehicle?.id ?? "",
        driverId: route.driver?.id ?? "",
      });
    } else {
      setFormData({ routeName: "", monthlyFee: 0, vehicleId: "", driverId: "" });
    }
  }, [mode, route, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.routeName) { toast.error("Route name is required"); return; }
    if (formData.monthlyFee <= 0) { toast.error("Monthly fee must be greater than 0"); return; }

    try {
      setLoading(true);
      let routeId: string;

      if (mode === "create") {
        const created = await api.createRoute({ routeName: formData.routeName, monthlyFee: formData.monthlyFee });
        routeId = created.id;
      } else {
        await api.updateRoute(route!.id, { routeName: formData.routeName, monthlyFee: formData.monthlyFee });
        routeId = route!.id;
      }

      if (formData.vehicleId) {
        const periodPayload = { vehicleId: formData.vehicleId, driverId: formData.driverId || undefined };
        const existingPeriodId = mode === "edit" ? route?.periodId : null;
        if (existingPeriodId) {
          await api.updateRoutePeriod(existingPeriodId, periodPayload);
        } else {
          await api.createRoutePeriod(routeId, periodPayload);
        }
      }

      toast.success(mode === "create" ? "Route created" : "Route updated");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Route" : "Edit Route"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="routeName">Route Name *</Label>
            <Input
              id="routeName"
              value={formData.routeName}
              onChange={(e) => setFormData({ ...formData, routeName: e.target.value })}
              placeholder="e.g., Route A – City Centre"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyFee">Monthly Fee ($) *</Label>
            <Input
              id="monthlyFee"
              type="number"
              min="0"
              step="0.01"
              value={formData.monthlyFee}
              onChange={(e) => setFormData({ ...formData, monthlyFee: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Assign Vehicle</Label>
            <Select
              value={formData.vehicleId || NONE}
              onValueChange={(v) => setFormData({ ...formData, vehicleId: v === NONE ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— No vehicle —</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.regNumber ? ` (${v.regNumber})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assign Driver</Label>
            <Select
              value={formData.driverId || NONE}
              onValueChange={(v) => setFormData({ ...formData, driverId: v === NONE ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="Select driver…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— No driver —</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}{d.staffEmployeeId ? ` · ${d.staffEmployeeId}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecting a vehicle automatically links it to this route for the current academic year.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create Route" : "Update Route"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
