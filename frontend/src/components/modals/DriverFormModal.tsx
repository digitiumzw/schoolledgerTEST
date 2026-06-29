import { useState, useEffect } from "react";
import { api } from "@/api/api";
import { TransportDriver } from "@/types/dashboard";
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
  driver?: TransportDriver | null;
}

export function DriverFormModal({ open, onOpenChange, onSuccess, driver }: Props) {
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; employeeId: string }>>([]);
  const [form, setForm] = useState({ name: "", phone: "", licenseNumber: "", staffId: "" });

  useEffect(() => {
    if (driver) {
      setForm({ name: driver.name, phone: driver.phone ?? "", licenseNumber: driver.licenseNumber ?? "", staffId: driver.staffId ?? "" });
    } else {
      setForm({ name: "", phone: "", licenseNumber: "", staffId: "" });
    }
  }, [driver, open]);

  useEffect(() => {
    if (!open) return;
    api.getStaff({ limit: 100 }).then((res) => {
      const list = res?.data ?? [];
      setStaffList(list.map((s: Record<string, string>) => ({
        id: s.id,
        name: `${s.firstName ?? s.first_name ?? ""} ${s.lastName ?? s.last_name ?? ""}`.trim(),
        employeeId: s.employeeId ?? s.employee_id ?? "",
      })));
    }).catch(() => {});
  }, [open]);

  const handleStaffChange = (value: string) => {
    if (value === "none") {
      setForm(f => ({ ...f, staffId: "" }));
    } else {
      const staff = staffList.find(s => s.id === value);
      setForm(f => ({ ...f, staffId: value, name: staff?.name ?? f.name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name && !form.staffId) { toast.error("Driver name or staff link is required"); return; }

    try {
      setLoading(true);
      const data = {
        name: form.name || undefined,
        staffId: form.staffId || undefined,
        phone: form.phone || undefined,
        licenseNumber: form.licenseNumber || undefined,
      };
      if (driver) {
        await api.updateDriver(driver.id, data);
        toast.success("Driver updated");
      } else {
        await api.createDriver(data);
        toast.success("Driver added");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save driver");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{driver ? "Edit Driver" : "Add Driver"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Link to Staff Member</Label>
            <Select value={form.staffId || "none"} onValueChange={handleStaffChange}>
              <SelectTrigger><SelectValue placeholder="Select staff…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (manual entry)</SelectItem>
                {staffList.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.employeeId})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Linking to staff auto-populates the name and enables kiosk access.</p>
          </div>
          <div className="space-y-2">
            <Label>Name {!form.staffId && "*"}</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Driver full name"
              disabled={!!form.staffId}
              className={form.staffId ? "bg-muted" : ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+263…" />
            </div>
            <div className="space-y-2">
              <Label>License Number</Label>
              <Input value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {driver ? "Update" : "Add Driver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
