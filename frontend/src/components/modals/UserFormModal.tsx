/**
 * User Form Modal Component
 * 
 * This modal is used for creating and editing admin users.
 * It includes form validation and handles both create and update operations.
 */

import { useState, useEffect } from "react";
import { api } from "@/api/api";
import { User } from "@/types/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface UserFormModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserFormModal({ user, open, onClose, onSuccess }: UserFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "admin" as "super_admin" | "admin" | "bursar" | "hr",
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      setFormData({
        name: "",
        email: "",
        role: "admin",
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Log the final form data before submission
    console.log('Submit - Final form data:', formData);

    // Validate required fields
    if (!formData.name || !formData.email) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      if (user) {
        // Update existing user
        await api.updateUser(user.id, formData);
        toast({
          title: "Success",
          description: "User updated successfully!",
        });
      } else {
        // Invite new user — backend creates a pending account and dispatches an email
        await api.inviteUser(formData);
        toast({
          title: "Invitation sent",
          description: `An invitation email has been sent to ${formData.email}.`,
        });
      }

      onSuccess();
    } catch (error: any) {
      const msg = error?.message || `Failed to ${user ? 'update' : 'invite'} user.`;
      toast({
        title: "Error",
        description: msg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Invite New User'}</DialogTitle>
          <DialogDescription>
            {user
              ? 'Update user information and permissions'
              : "Enter the user's name, email, and role. They'll receive an invitation email to set their own password."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full name"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select 
              value={formData.role} 
              onValueChange={value => {
                console.log('Role changed from', formData.role, 'to', value);
                setFormData({ ...formData, role: value as "super_admin" | "admin" | "bursar" | "hr" });
              }}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="bursar">Bursar</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user ? 'Update User' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
