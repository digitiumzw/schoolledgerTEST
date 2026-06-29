import { useState, useEffect } from "react";
import { api } from "@/api/api";
import { TransportVehicle } from "@/types/dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  vehicle?: TransportVehicle | null;
}

export function VehicleFormModal({ open, onOpenChange, onSuccess, vehicle }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", regNumber: "", type: "bus", capacity: 40 });

  useEffect(() => {
    if (vehicle) {
      setForm({ name: vehicle.name, regNumber: vehicle.regNumber ?? "", type: vehicle.type, capacity: vehicle.capacity });
    } else {
      setForm({ name: "", regNumber: "", type: "bus", capacity: 40 });
    }
  }, [vehicle, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error("Vehicle name is required"); return; }
    if (form.capacity < 1) { toast.error("Capacity must be at least 1"); return; }

    try {
      setLoading(true);
      const data = { ...form, regNumber: form.regNumber || undefined };
      if (vehicle) {
        await api.updateVehicle(vehicle.id, data);
        toast.success("Vehicle updated");
      } else {
        await api.createVehicle(data);
        toast.success("Vehicle created");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save vehicle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Bus 1" required />
          </div>
          <div className="space-y-2">
            <Label>Registration Number</Label>
            <Input value={form.regNumber} onChange={e => setForm({ ...form, regNumber: e.target.value })} placeholder="e.g., ABC 1234" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bus">Bus</SelectItem>
                  <SelectItem value="minibus">Minibus</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity *</Label>
              <Input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} required />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {vehicle ? "Update" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
