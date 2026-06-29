import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/api/api";
import { Student, Class, StudentFormData } from "@/types/dashboard";
import { toast } from "sonner";
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Loader2, AlertTriangle, History } from "lucide-react";

// Fields that require a change reason when updated (must match backend MUTABLE_FIELDS)
const HISTORICAL_PROFILE_FIELDS = [
  'email', 'address',
  'guardianName', 'guardianPhone', 'guardianEmail', 'guardianRelationship',
  'guardian2Name', 'guardian2Phone', 'guardian2Relationship',
  'bursaryStatus', 'bursaryPercentage', 'bursaryReason'
];

interface StudentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student | null;
  onSuccess?: () => void;
}

export function StudentFormModal({ open, onOpenChange, student, onSuccess }: StudentFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [formData, setFormData] = useState<StudentFormData>({
    firstName: "",
    lastName: "",
    admissionNumber: "",
    gender: undefined,
    classId: "",
    dateOfBirth: "",
    nationalId: "",
    email: "",
    address: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianRelationship: "Parent",
    guardian2Name: "",
    guardian2Phone: "",
    guardian2Relationship: "",
    bursaryStatus: "none",
    bursaryPercentage: 0,
    bursaryReason: "",
    openingBalance: undefined,
    balanceReason: "",
    enrollmentDate: new Date().toISOString().split('T')[0],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormData, string>>>({});
  const [profileChangeReason, setProfileChangeReason] = useState("");
  const [showReasonField, setShowReasonField] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      const classData = await api.getClasses();
      setClasses(classData);
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (student) {
      setFormData({
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNumber: student.admissionNumber || "",
        gender: student.gender,
        classId: student.classId,
        dateOfBirth: student.dateOfBirth || "",
        nationalId: student.nationalId || "",
        email: student.email || "",
        address: student.address || "",
        guardianName: student?.guardian?.name ?? "",
        guardianPhone: student?.guardian?.phone ?? "",
        guardianEmail: student?.guardian?.email ?? "",
        guardianRelationship: student?.guardian?.relationship ?? "Parent",
        guardian2Name: student?.guardian2?.name ?? "",
        guardian2Phone: student?.guardian2?.phone ?? "",
        guardian2Relationship: student?.guardian2?.relationship ?? "",
        bursaryStatus: student.bursaryStatus || "none",
        bursaryPercentage: student.bursaryPercentage || 0,
        bursaryReason: student.bursaryReason || "",
      });
      setProfileChangeReason("");
      setShowReasonField(false);
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        admissionNumber: "",
        gender: undefined,
        classId: "",
        dateOfBirth: "",
        nationalId: "",
        email: "",
        address: "",
        guardianName: "",
        guardianPhone: "",
        guardianEmail: "",
        guardianRelationship: "Parent",
        guardian2Name: "",
        guardian2Phone: "",
        guardian2Relationship: "",
        bursaryStatus: "none",
        bursaryPercentage: 0,
        bursaryReason: "",
        openingBalance: undefined,
        balanceReason: "",
        enrollmentDate: new Date().toISOString().split('T')[0],
      });
    }
    setErrors({});
    setProfileChangeReason("");
    setShowReasonField(false);
  }, [student, open]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof StudentFormData, string>> = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.classId) newErrors.classId = "Please select a class";
    if (!formData.guardianName.trim()) newErrors.guardianName = "Guardian name is required";
    if (!formData.guardianPhone.trim()) {
      newErrors.guardianPhone = "Guardian phone is required";
    } else if (!/^\+?[0-9]{10,}$/.test(formData.guardianPhone.replace(/[\s\-().]/g, ""))) {
      newErrors.guardianPhone = "Invalid phone number format";
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    
    if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
      newErrors.guardianEmail = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if any historical profile fields have changed
  const hasHistoricalFieldChanges = (): boolean => {
    if (!student) return false;
    
    const originalData = {
      email: student.email || "",
      address: student.address || "",
      guardianName: student?.guardian?.name ?? "",
      guardianPhone: student?.guardian?.phone ?? "",
      guardianEmail: student?.guardian?.email ?? "",
      guardianRelationship: student?.guardian?.relationship ?? "Parent",
      guardian2Name: student?.guardian2?.name ?? "",
      guardian2Phone: student?.guardian2?.phone ?? "",
      guardian2Relationship: student?.guardian2?.relationship ?? "",
      bursaryStatus: student.bursaryStatus || "none",
      bursaryPercentage: student.bursaryPercentage || 0,
      bursaryReason: student.bursaryReason || "",
    };

    return HISTORICAL_PROFILE_FIELDS.some(field => {
      const key = field as keyof StudentFormData;
      const original = originalData[key as keyof typeof originalData] ?? "";
      const current = formData[key] ?? "";
      return String(original) !== String(current);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    // Check if we need a profile change reason
    const needsReason = student && hasHistoricalFieldChanges();
    if (needsReason && !showReasonField) {
      setShowReasonField(true);
      toast.info("Please provide a reason for the profile changes");
      return;
    }
    
    if (needsReason && !profileChangeReason.trim()) {
      toast.error("Profile change reason is required");
      return;
    }

    try {
      setLoading(true);
      
      const submitData = needsReason 
        ? { ...formData, profileChangeReason }
        : formData;
      
      if (student) {
        await api.updateStudent(student.id, submitData);
        toast.success("Student updated successfully");
      } else {
        await api.createStudent(formData);
        toast.success("Student added successfully");
      }
      
      onSuccess?.();
      onOpenChange(false);
      setProfileChangeReason("");
      setShowReasonField(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save student");
      console.error("Error saving student:", error);
    } finally {
      setLoading(false);
    }
  };

  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? "Edit Student" : "Add New Student"}</DialogTitle>
          <DialogDescription>
            {student ? "Update student information below." : "Enter the student details below."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Student Information</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={errors.firstName ? "border-destructive" : ""}
                />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={errors.lastName ? "border-destructive" : ""}
                />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admissionNumber">Admission Number</Label>
                <Input
                  id="admissionNumber"
                  value={formData.admissionNumber || ""}
                  onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                  disabled={!!student}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender || ""}
                  onValueChange={(value) => setFormData({ ...formData, gender: value as StudentFormData['gender'] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classId">Class *</Label>
                <Select value={formData.classId} onValueChange={(value) => setFormData({ ...formData, classId: value })}>
                  <SelectTrigger className={errors.classId ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classId && <p className="text-xs text-destructive">{errors.classId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth || ""}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationalId">National ID / Birth Certificate No.</Label>
              <Input
                id="nationalId"
                value={formData.nationalId || ""}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                placeholder="e.g. 63-2145678A21"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground">Bursary Information</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bursaryStatus">Bursary Status</Label>
                <Select 
                  value={formData.bursaryStatus} 
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    bursaryStatus: value as 'full' | 'partial' | 'none',
                    bursaryPercentage: value === 'none' ? 0 : formData.bursaryPercentage 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Bursary</SelectItem>
                    <SelectItem value="partial">Partial Bursary</SelectItem>
                    <SelectItem value="full">Full Bursary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.bursaryStatus !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="bursaryPercentage">
                    Bursary Percentage 
                    {formData.bursaryStatus === 'full' && (
                      <span className="text-xs text-muted-foreground ml-2">(Auto-set to 100% for full bursary)</span>
                    )}
                  </Label>
                  <Input
                    id="bursaryPercentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.bursaryStatus === 'full' ? 100 : formData.bursaryPercentage}
                    onChange={(e) => setFormData({ ...formData, bursaryPercentage: parseInt(e.target.value) || 0 })}
                    disabled={formData.bursaryStatus === 'full'}
                    className={formData.bursaryStatus === 'full' ? 'bg-muted cursor-not-allowed' : ''}
                  />
                  {formData.bursaryStatus === 'full' && (
                    <p className="text-xs text-muted-foreground">
                      Full bursary automatically sets the percentage to 100%
                    </p>
                  )}
                </div>
              )}
            </div>

            {formData.bursaryStatus !== 'none' && (
              <div className="space-y-2">
                <Label htmlFor="bursaryReason">Bursary Reason</Label>
                <Textarea
                  id="bursaryReason"
                  value={formData.bursaryReason}
                  onChange={(e) => setFormData({ ...formData, bursaryReason: e.target.value })}
                  rows={2}
                  placeholder="Reason for bursary (e.g., Financial hardship, Academic excellence)"
                />
              </div>
            )}
          </div>

          {!student && (
            <div className="space-y-4 border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground">Enrollment Date</h4>
              <p className="text-xs text-muted-foreground">
                The date this student enrolls. Used to calculate prorated charges when billing proration is enabled.
              </p>
              <div className="space-y-2">
                <Label htmlFor="enrollmentDate">Enrollment Date</Label>
                <Input
                  id="enrollmentDate"
                  type="date"
                  value={formData.enrollmentDate || ""}
                  onChange={(e) => setFormData({ ...formData, enrollmentDate: e.target.value })}
                />
              </div>
            </div>
          )}

          {!student && (
            <div className="space-y-4 border-t border-border pt-4">
              <h4 className="text-sm font-semibold text-foreground">Opening Balance (Optional)</h4>
              <p className="text-xs text-muted-foreground">
                If this student is transferring from paper records or spreadsheets with existing fees owed
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openingBalance">Amount Owed ($)</Label>
                  <Input
                    id="openingBalance"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.openingBalance || ""}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      openingBalance: e.target.value ? parseFloat(e.target.value) : undefined 
                    })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="balanceReason">Description/Reason</Label>
                  <Input
                    id="balanceReason"
                    value={formData.balanceReason || ""}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      balanceReason: e.target.value 
                    })}
                    placeholder="e.g., 2024 Term 2 & 3 fees"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground">Guardian Information</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardianName">Guardian Name *</Label>
                <Input
                  id="guardianName"
                  value={formData.guardianName}
                  onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  className={errors.guardianName ? "border-destructive" : ""}
                />
                {errors.guardianName && <p className="text-xs text-destructive">{errors.guardianName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardianRelationship">Relationship</Label>
                <Select 
                  value={formData.guardianRelationship} 
                  onValueChange={(value) => setFormData({ ...formData, guardianRelationship: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mother">Mother</SelectItem>
                    <SelectItem value="Father">Father</SelectItem>
                    <SelectItem value="Parent">Parent</SelectItem>
                    <SelectItem value="Guardian">Guardian</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardianPhone">Guardian Phone *</Label>
                <Input
                  id="guardianPhone"
                  value={formData.guardianPhone}
                  onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                  placeholder="+263771234567"
                  className={errors.guardianPhone ? "border-destructive" : ""}
                />
                {errors.guardianPhone && <p className="text-xs text-destructive">{errors.guardianPhone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardianEmail">Guardian Email</Label>
                <Input
                  id="guardianEmail"
                  type="email"
                  value={formData.guardianEmail || ""}
                  onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                  className={errors.guardianEmail ? "border-destructive" : ""}
                />
                {errors.guardianEmail && <p className="text-xs text-destructive">{errors.guardianEmail}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground">Second Guardian / Emergency Contact <span className="text-muted-foreground font-normal">(Optional)</span></h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guardian2Name">Name</Label>
                <Input
                  id="guardian2Name"
                  value={formData.guardian2Name || ""}
                  onChange={(e) => setFormData({ ...formData, guardian2Name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guardian2Relationship">Relationship</Label>
                <Input
                  id="guardian2Relationship"
                  value={formData.guardian2Relationship || ""}
                  onChange={(e) => setFormData({ ...formData, guardian2Relationship: e.target.value })}
                  placeholder="e.g. Father, Uncle"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guardian2Phone">Phone</Label>
              <Input
                id="guardian2Phone"
                value={formData.guardian2Phone || ""}
                onChange={(e) => setFormData({ ...formData, guardian2Phone: e.target.value })}
                placeholder="+263771234567"
              />
            </div>
          </div>

          {showReasonField && student && (
            <div className="space-y-3 border-t border-border pt-4 bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <History className="h-4 w-4" />
                <Label htmlFor="profileChangeReason" className="font-semibold">
                  Profile Change Reason *
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                You&apos;ve modified historical profile fields (email, address, guardian info, or bursary details). 
                Please provide a reason for this change to maintain the audit history.
              </p>
              <Textarea
                id="profileChangeReason"
                value={profileChangeReason}
                onChange={(e) => setProfileChangeReason(e.target.value)}
                placeholder="e.g., Updated guardian contact after parent meeting, Corrected address after move"
                rows={2}
                className="border-amber-200 dark:border-amber-800"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {student ? (showReasonField ? "Confirm Update" : "Update Student") : "Add Student"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
