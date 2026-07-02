import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "@/types/dashboard";

export interface SchoolInfoFormProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export function SchoolInfoForm({ settings, onSettingsChange }: SchoolInfoFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label htmlFor="schoolName">School Name *</Label>
        <Input
          id="schoolName"
          value={settings.schoolName}
          onChange={(e) => onSettingsChange({ ...settings, schoolName: e.target.value })}
          placeholder="Enter school name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactEmail">Contact Email *</Label>
        <Input
          id="contactEmail"
          type="email"
          value={settings.contactEmail}
          onChange={(e) => onSettingsChange({ ...settings, contactEmail: e.target.value })}
          placeholder="info@school.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactPhone">Contact Phone *</Label>
        <Input
          id="contactPhone"
          value={settings.contactPhone}
          onChange={(e) => onSettingsChange({ ...settings, contactPhone: e.target.value })}
          placeholder="+263 712 000 000"
        />
      </div>

      <div className="space-y-2 md:col-span-1">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={settings.address}
          onChange={(e) => onSettingsChange({ ...settings, address: e.target.value })}
          placeholder="Physical address"
        />
      </div>
    </div>
  );
}
