import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/api";
import { PaymentCategory } from "@/types/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Edit, GraduationCap, HelpCircle, Lock, Plus, ShieldCheck, Tag, Trash2, WalletCards } from "lucide-react";
import { isSystemCategoryId } from "@/constants/paymentCategories";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentCategoryFormModal } from "@/components/modals/PaymentCategoryFormModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function formatCategoryAmount(amount: number | null | undefined) {
  return amount !== null && amount !== undefined ? `$${amount.toFixed(2)}` : "Flexible";
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof WalletCards;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

export function PaymentCategoriesTab() {
  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory | null>(null);
  const { toast } = useToast();

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("payment-categories-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("payment-categories-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPaymentCategories();
      setCategories(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load payment categories.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleToggleStatus = async (category: PaymentCategory) => {
    try {
      await api.updatePaymentCategory(category.id, { ...category, active: !category.active });
      await loadCategories();
      toast({
        title: "Success",
        description: `Category ${category.active ? 'deactivated' : 'activated'} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update category status.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    try {
      await api.deletePaymentCategory(selectedCategory.id);
      await loadCategories();
      toast({
        title: "Success",
        description: "Category deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete category.",
        variant: "destructive"
      });
    } finally {
      setShowDeleteDialog(false);
      setSelectedCategory(null);
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

  const systemCategories = categories.filter(category => category.system === true || isSystemCategoryId(category.id));
  const customCategories = categories.filter(category => !category.system && !isSystemCategoryId(category.id));
  const activeCategoryCount = categories.filter(category => category.active).length;
  const inactiveCategoryCount = categories.length - activeCategoryCount;
  const defaultAmountCount = categories.filter(category => category.defaultAmount !== null).length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Payment Categories guide
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Categories"
            value={categories.length}
            icon={WalletCards}
          />
          <StatCard
            label="Active"
            value={activeCategoryCount}
            icon={ShieldCheck}
          />
          <StatCard
            label="System Categories"
            value={systemCategories.length}
            icon={Lock}
          />
          <StatCard
            label="With Defaults"
            value={defaultAmountCount}
            icon={Tag}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 px-6 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <WalletCards className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Category Directory</CardTitle>
                    <CardDescription className="mt-1">
                      Manage payment types for receipts and ledger entries
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => {
                  setSelectedCategory(null);
                  setShowModal(true);
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Category
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[200px]">Name</TableHead>
                      <TableHead className="w-[120px]">Default Amount</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <WalletCards className="h-8 w-8 opacity-40" />
                            <p>No categories found</p>
                            <p className="text-sm opacity-60">Create your first payment category to get started</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      categories.map(category => {
                        const isSystem = category.system === true || isSystemCategoryId(category.id);
                        return (
                          <TableRow key={category.id} className={!category.active ? 'opacity-50 bg-muted/20' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="rounded-md bg-muted p-1">
                                  {isSystem ? (
                                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </div>
                                <span className="font-medium">{category.name}</span>
                                {isSystem && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted border">
                                    System
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="tabular-nums text-sm">
                              {formatCategoryAmount(category.defaultAmount)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={category.active}
                                  onCheckedChange={() => handleToggleStatus(category)}
                                  disabled={isSystem}
                                />
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted border">
                                  {category.active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isSystem}
                                  title={isSystem ? "System categories cannot be edited" : "Edit category"}
                                  onClick={() => {
                                    setSelectedCategory(category);
                                    setShowModal(true);
                                  }}
                                  className="h-8 w-8"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isSystem}
                                  title={isSystem ? "System categories cannot be deleted" : "Delete category"}
                                  onClick={() => {
                                    setSelectedCategory(category);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Guardrails
                </CardTitle>
                <CardDescription>Keep payment capture consistent.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {[
                  ["Protect", "System categories are locked — reports and payment flows depend on them."],
                  ["Name clearly", "Use names that match how users identify payment types at receipt time."],
                  ["Use defaults", "Set default amounts only when a category has a predictable value."],
                  ["Deactivate", "Deactivate instead of deleting if they may appear in historical records."],
                ].map(([title, detail]) => (
                  <div key={title} className="border-b py-2.5 last:border-0">
                    <p className="text-xs font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Intake Summary</CardTitle>
                <CardDescription>Category availability snapshot.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {[
                  ["Custom", customCategories.length],
                  ["Active", activeCategoryCount],
                  ["Inactive", inactiveCategoryCount],
                  ["Preset defaults", defaultAmountCount],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex items-center justify-between border-b py-2.5 last:border-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold tabular-nums">{val}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showModal && (
        <PaymentCategoryFormModal
          category={selectedCategory}
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedCategory(null);
          }}
          onSuccess={() => {
            loadCategories();
            setShowModal(false);
            setSelectedCategory(null);
          }}
        />
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-destructive" />
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCategory(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Payment Categories
            </DialogTitle>
            <DialogDescription>
              How payment categories work and how to manage them effectively.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "What are Categories", "Categories classify every payment recorded in the system — such as Fees, Transport, or Development Fund. They appear on receipts, reports, and the student ledger.", Tag],
              ["2", "System Categories", "Built-in categories like Fees and Transport are protected. Reports and ledger calculations depend on them, so they cannot be edited or deleted.", Lock],
              ["3", "Custom Categories", "Create your own categories for school-specific needs — e.g., Donations, PTA, or Events. You control their name, default amount, and active status.", WalletCards],
              ["4", "Default Amounts", "Set a default amount when a category has a predictable value. This pre-fills the amount field during payment recording and speeds up daily collections.", ShieldCheck],
              ["5", "Active vs Inactive", "Deactivate a category instead of deleting it if it appears in historical records. Inactive categories are hidden from new payments but keep past data intact.", ShieldCheck],
            ].map(([step, title, detail, Icon]) => (
              <div key={step} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                  {step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pc-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="pc-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
