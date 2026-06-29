/**
 * User Accounts Tab Component
 * 
 * This component manages admin user accounts with the following features:
 * - Table view of all users with search and filters
 * - Create new admin users
 * - Edit existing user details
 * - Toggle user active/inactive status
 * - Reset user passwords
 * - Delete users (with confirmation)
 */

import { useState, useEffect, useMemo } from "react";
import { api } from "@/api/api";
import { User } from "@/types/dashboard";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Edit, Trash2, Power, RefreshCw, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserFormModal } from "@/components/modals/UserFormModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function UserAccountsTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load users.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // School admins must not see super_admin accounts
      if (!isSuperAdmin && user.role === 'super_admin') return false;
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = filterRole === "all" || user.role === filterRole;
      const matchesStatus = filterStatus === "all" || user.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, filterRole, filterStatus, isSuperAdmin]);

  const handleResendInvite = async (user: User) => {
    try {
      setResendingId(user.id);
      await api.resendInvite(user.id);
      toast({
        title: "Invitation resent",
        description: `A new invitation email has been sent to ${user.email}.`,
      });
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to resend invitation.",
        variant: "destructive"
      });
    } finally {
      setResendingId(null);
    }
  };

  const handleToggleStatus = async (user: User) => {
    // Prevent deactivating Super Admin accounts
    if (user.role === 'super_admin' && user.status === 'active') {
      toast({
        title: "Action Not Allowed",
        description: "Super Admin accounts cannot be deactivated.",
        variant: "destructive"
      });
      return;
    }
    
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await api.toggleUserStatus(user.id);
      await loadUsers();
      toast({
        title: "Success",
        description: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    // Prevent deleting Super Admin accounts
    if (selectedUser.role === 'super_admin') {
      toast({
        title: "Action Not Allowed",
        description: "Super Admin accounts cannot be deleted.",
        variant: "destructive"
      });
      setShowDeleteDialog(false);
      setSelectedUser(null);
      return;
    }
    
    try {
      await api.deleteUser(selectedUser.id);
      await loadUsers();
      toast({
        title: "Success",
        description: "User deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive"
      });
    } finally {
      setShowDeleteDialog(false);
      setSelectedUser(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'destructive';
      case 'admin': return 'default';
      case 'teacher': return 'secondary';
      case 'bursar': return 'secondary';
      case 'hr': return 'secondary';
      default: return 'outline';
    }
  };
  
  // Helper to format role display name
  const formatRoleName = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'teacher': return 'Teacher';
      case 'bursar': return 'Bursar';
      case 'hr': return 'HR';
      default: return role;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Accounts</CardTitle>
              <CardDescription>
                {isSuperAdmin
                  ? "Manage platform user accounts and permissions"
                  : "Manage staff accounts within your school"}
              </CardDescription>
            </div>
            <Button onClick={() => {
              setSelectedUser(null);
              setShowUserModal(true);
            }}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="bursar">Bursar</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {formatRoleName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === 'active'
                              ? 'default'
                              : user.status === 'invited'
                              ? 'outline'
                              : 'secondary'
                          }
                          className={user.status === 'invited' ? 'border-amber-500 text-amber-700 dark:text-amber-400' : ''}
                        >
                          {user.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(user)}
                            disabled={user.status === 'invited'}
                            title={user.status === 'invited' ? 'Cannot toggle status while invitation is pending' : 'Toggle status'}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          {user.status === 'invited' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleResendInvite(user)}
                              disabled={resendingId === user.id}
                              title="Resend invitation"
                            >
                              <RefreshCw className={`h-4 w-4 ${resendingId === user.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showUserModal && (
        <UserFormModal
          user={selectedUser}
          open={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            loadUsers();
            setShowUserModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUser(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
