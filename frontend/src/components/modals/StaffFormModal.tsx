import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { api } from '@/api/api';
import { Staff } from '@/types/dashboard';

interface StaffFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: Staff;
  onSuccess: () => void;
}

export function StaffFormModal({ open, onOpenChange, staff, onSuccess }: StaffFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [hireDate, setHireDate] = useState<Date | undefined>(
    staff?.hireDate ? new Date(staff.hireDate) : undefined
  );
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(
    staff?.dateOfBirth ? new Date(staff.dateOfBirth) : undefined
  );
  const [dateInputValue, setDateInputValue] = useState(
    staff?.dateOfBirth ? format(new Date(staff.dateOfBirth), 'MM/dd/yyyy') : ''
  );
  const [hireDateInputValue, setHireDateInputValue] = useState(
    staff?.hireDate ? format(new Date(staff.hireDate), 'MM/dd/yyyy') : ''
  );

  // Helper function to parse various date formats
  const parseDateInput = (input: string): Date | null => {
    if (!input.trim()) return null;
    
    // Try different date formats
    const formats = [
      'MM/dd/yyyy',
      'M/d/yyyy',
      'MM-dd-yyyy',
      'M-d-yyyy',
      'yyyy-MM-dd',
      'MMM dd, yyyy',
      'MMMM dd, yyyy'
    ];
    
    for (const dateFormat of formats) {
      try {
        const parsed = parse(input, dateFormat, new Date());
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
    
    return null;
  };

  const handleDateInputChange = (value: string, type: 'birth' | 'hire') => {
    if (type === 'birth') {
      setDateInputValue(value);
      const parsed = parseDateInput(value);
      setDateOfBirth(parsed || undefined);
    } else {
      setHireDateInputValue(value);
      const parsed = parseDateInput(value);
      setHireDate(parsed || undefined);
    }
  };

  const handleCalendarSelect = (date: Date | undefined, type: 'birth' | 'hire') => {
    if (type === 'birth') {
      setDateOfBirth(date);
      setDateInputValue(date ? format(date, 'MM/dd/yyyy') : '');
    } else {
      setHireDate(date);
      setHireDateInputValue(date ? format(date, 'MM/dd/yyyy') : '');
    }
  };
  const [formData, setFormData] = useState({
    firstName: staff?.firstName || '',
    lastName: staff?.lastName || '',
    email: staff?.email || '',
    phone: staff?.phone || '',
    address: staff?.address || '',
    position: staff?.position || '',
    department: staff?.department || '',
    isTeaching: staff?.isTeaching || false,
    employmentStatus: staff?.employmentStatus || 'active',
    nextOfKinName: staff?.nextOfKin?.name || '',
    nextOfKinRelationship: staff?.nextOfKin?.relationship || '',
    nextOfKinPhone: staff?.nextOfKin?.phone || '',
    nextOfKinEmail: staff?.nextOfKin?.email || '',
    nextOfKinAddress: staff?.nextOfKin?.address || '',
    dateOfBirth: staff?.dateOfBirth || '',
  });

  type FormData = typeof formData;

  useEffect(() => {
    if (staff) {
      setFormData({
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        phone: staff.phone,
        address: staff.address || '',
        position: staff.position,
        department: staff.department,
        isTeaching: staff.isTeaching,
        employmentStatus: staff.employmentStatus || 'active',
        nextOfKinName: staff.nextOfKin?.name || '',
        nextOfKinRelationship: staff.nextOfKin?.relationship || '',
        nextOfKinPhone: staff.nextOfKin?.phone || '',
        nextOfKinEmail: staff.nextOfKin?.email || '',
        nextOfKinAddress: staff.nextOfKin?.address || '',
        dateOfBirth: staff.dateOfBirth || '',
      });
      setHireDate(staff.hireDate ? new Date(staff.hireDate) : undefined);
      setDateOfBirth(staff.dateOfBirth ? new Date(staff.dateOfBirth) : undefined);
      setHireDateInputValue(staff.hireDate ? format(new Date(staff.hireDate), 'MM/dd/yyyy') : '');
      setDateInputValue(staff.dateOfBirth ? format(new Date(staff.dateOfBirth), 'MM/dd/yyyy') : '');
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        position: '',
        department: '',
        isTeaching: false,
        employmentStatus: 'active',
        nextOfKinName: '',
        nextOfKinRelationship: '',
        nextOfKinPhone: '',
        nextOfKinEmail: '',
        nextOfKinAddress: '',
        dateOfBirth: '',
      });
      setHireDate(undefined);
      setDateOfBirth(undefined);
      setHireDateInputValue('');
      setDateInputValue('');
    }
  }, [staff, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('First name and last name are required');
      return;
    }

    if (formData.email.trim() && !formData.email.includes('@')) {
      toast.error('Please enter a valid email address or leave blank');
      return;
    }

    if (!formData.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    // Validate phone format (normalize before checking)
    const normalizedPhone = formData.phone.replace(/[\s\-().]/g, '');
    if (!/^\+?[0-9]{10,}$/.test(normalizedPhone)) {
      toast.error('Invalid phone number format. Use digits, spaces, dashes, or parentheses.');
      return;
    }

    // Validate hire date is not in the future
    if (hireDate && hireDate > new Date()) {
      toast.error('Hire date cannot be in the future.');
      return;
    }

    // Validate date of birth implies a plausible age (16–100)
    if (dateOfBirth) {
      const ageYears = (Date.now() - dateOfBirth.getTime()) / 31557600000;
      if (ageYears < 16 || ageYears > 100) {
        toast.error('Date of birth must reflect an age between 16 and 100.');
        return;
      }
    }

    if (!formData.position.trim()) {
      toast.error('Position is required');
      return;
    }

    if (!formData.department.trim()) {
      toast.error('Department is required');
      return;
    }

    setLoading(true);

    try {
      const staffData = {
        ...formData,
        hireDate: hireDate ? format(hireDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        dateOfBirth: dateOfBirth ? format(dateOfBirth, 'yyyy-MM-dd') : null,
        nextOfKin: formData.nextOfKinName ? {
          name: formData.nextOfKinName,
          relationship: formData.nextOfKinRelationship,
          phone: formData.nextOfKinPhone,
          email: formData.nextOfKinEmail || undefined,
          address: formData.nextOfKinAddress,
        } : undefined,
      };

      if (staff) {
        await api.updateStaff(staff.id, staffData);
        toast.success('Staff member updated successfully');
      } else {
        await api.createStaff(staffData);
        toast.success('Staff member added successfully');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save staff member');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Enter first name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Enter last name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+263 77 123 4567"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter staff member's address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Position *</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g., Mathematics Teacher"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teaching Staff">Teaching Staff</SelectItem>
                  <SelectItem value="Administration">Administration</SelectItem>
                  <SelectItem value="Bursar">Bursar</SelectItem>
                  <SelectItem value="Security">Security</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="isTeaching">Teaching Staff</Label>
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  id="isTeaching"
                  checked={formData.isTeaching}
                  onCheckedChange={(checked) => setFormData({ ...formData, isTeaching: checked })}
                />
                <Label htmlFor="isTeaching" className="cursor-pointer">
                  {formData.isTeaching ? 'Yes' : 'No'}
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employmentStatus">Employment Status</Label>
              <Select
                value={formData.employmentStatus}
                onValueChange={(value) => setFormData({ ...formData, employmentStatus: value as Staff['employmentStatus'] })}
              >
                <SelectTrigger id="employmentStatus">
                  <SelectValue placeholder="Select employment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="resigned">Terminated</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next of Kin Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Next of Kin Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinName">Next of Kin Name</Label>
                <Input
                  id="nextOfKinName"
                  value={formData.nextOfKinName}
                  onChange={(e) => setFormData({ ...formData, nextOfKinName: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextOfKinRelationship">Relationship</Label>
                <Input
                  id="nextOfKinRelationship"
                  value={formData.nextOfKinRelationship}
                  onChange={(e) => setFormData({ ...formData, nextOfKinRelationship: e.target.value })}
                  placeholder="e.g., Spouse, Parent, Sibling"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nextOfKinPhone">Contact Phone</Label>
                <Input
                  id="nextOfKinPhone"
                  value={formData.nextOfKinPhone}
                  onChange={(e) => setFormData({ ...formData, nextOfKinPhone: e.target.value })}
                  placeholder="+263 77 123 4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextOfKinEmail">Contact Email (Optional)</Label>
                <Input
                  id="nextOfKinEmail"
                  type="email"
                  value={formData.nextOfKinEmail}
                  onChange={(e) => setFormData({ ...formData, nextOfKinEmail: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextOfKinAddress">Next of Kin Address</Label>
              <Input
                id="nextOfKinAddress"
                value={formData.nextOfKinAddress}
                onChange={(e) => setFormData({ ...formData, nextOfKinAddress: e.target.value })}
                placeholder="Enter next of kin's physical address"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <div className="flex gap-2">
                <Input
                  id="dateOfBirth"
                  type="text"
                  placeholder="MM/DD/YYYY"
                  value={dateInputValue}
                  onChange={(e) => handleDateInputChange(e.target.value, 'birth')}
                  className="flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        'shrink-0',
                        !dateOfBirth && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={dateOfBirth}
                      onSelect={(date) => handleCalendarSelect(date, 'birth')}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground">
                Format: MM/DD/YYYY (e.g., 12/31/1990)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hireDate">Hire Date</Label>
              <div className="flex gap-2">
                <Input
                  id="hireDate"
                  type="text"
                  placeholder="MM/DD/YYYY"
                  value={hireDateInputValue}
                  onChange={(e) => handleDateInputChange(e.target.value, 'hire')}
                  className="flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        'shrink-0',
                        !hireDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={hireDate}
                      onSelect={(date) => handleCalendarSelect(date, 'hire')}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground">
                Format: MM/DD/YYYY (e.g., 08/15/2023)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {staff ? 'Update' : 'Add'} Staff Member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
