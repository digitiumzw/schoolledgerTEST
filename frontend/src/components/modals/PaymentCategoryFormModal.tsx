import { useState, useEffect } from "react";
import { api } from "@/api/api";
import { PaymentCategory } from "@/types/dashboard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PaymentCategoryFormModalProps {
  category: PaymentCategory | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentCategoryFormModal({ category, open, onClose, onSuccess }: PaymentCategoryFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    defaultAmount: "" as string | number,
    active: true,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        defaultAmount: category.defaultAmount !== null ? category.defaultAmount : "",
        active: category.active,
      });
    } else {
      setFormData({
        name: "",
        defaultAmount: "",
        active: true,
      });
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required.",
        variant: "destructive"
      });
      return;
    }

    // Validate default amount if provided
    if (formData.defaultAmount !== "" && (isNaN(Number(formData.defaultAmount)) || Number(formData.defaultAmount) < 0)) {
      toast({
        title: "Validation Error",
        description: "Default amount must be a positive number.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const categoryData = {
        name: formData.name.trim(),
        defaultAmount: formData.defaultAmount === "" ? null : Number(formData.defaultAmount),
        active: formData.active,
      };

      if (category) {
        // Update existing category
        await api.updatePaymentCategory(category.id, categoryData);
        toast({
          title: "Success",
          description: "Category updated successfully!",
        });
      } else {
        // Create new category
        await api.createPaymentCategory(categoryData);
        toast({
          title: "Success",
          description: "Category created successfully!",
        });
      }
      
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${category ? 'update' : 'create'} category.`,
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
          <DialogTitle>{category ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          <DialogDescription>
            {category ? 'Update payment category information' : 'Create a new payment category'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Transport Fee"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultAmount">Default Amount (optional)</Label>
            <Input
              id="defaultAmount"
              type="number"
              value={formData.defaultAmount}
              onChange={e => setFormData({ ...formData, defaultAmount: e.target.value })}
              placeholder="Leave empty for no default"
              step="0.01"
              min="0"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              This amount will be pre-filled when recording payments in this category
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="active">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Inactive categories are hidden from payment forms
              </p>
            </div>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={value => setFormData({ ...formData, active: value })}
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {category ? 'Update' : 'Create'} Category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
