/**
 * AuditLogViewer
 * 
 * Component for viewing the reconciliation audit trail.
 * Displays all financial actions with filtering capabilities.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  Plus,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Clock,
  DollarSign,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";

interface AuditEntry {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  studentId: string | null;
  amount: number | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  performedBy: string;
  performedByName: string | null;
  performedAt: string;
}

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  adjustment_created: { label: "Adjustment Created", icon: Plus, color: "bg-blue-100 text-blue-700" },
  adjustment_approved: { label: "Adjustment Approved", icon: Check, color: "bg-green-100 text-green-700" },
  adjustment_rejected: { label: "Adjustment Rejected", icon: X, color: "bg-red-100 text-red-700" },
  adjustment_voided: { label: "Adjustment Voided", icon: AlertTriangle, color: "bg-orange-100 text-orange-700" },
  refund_initiated: { label: "Refund Initiated", icon: RotateCcw, color: "bg-purple-100 text-purple-700" },
  refund_processed: { label: "Refund Processed", icon: ArrowRight, color: "bg-blue-100 text-blue-700" },
  refund_completed: { label: "Refund Completed", icon: Check, color: "bg-green-100 text-green-700" },
  refund_cancelled: { label: "Refund Cancelled", icon: X, color: "bg-red-100 text-red-700" },
  balance_recalculated: { label: "Balance Recalculated", icon: RefreshCw, color: "bg-gray-100 text-gray-700" },
  charge_voided: { label: "Charge Voided", icon: AlertTriangle, color: "bg-orange-100 text-orange-700" },
  payment_voided: { label: "Payment Voided", icon: AlertTriangle, color: "bg-orange-100 text-orange-700" },
  manual_override: { label: "Manual Override", icon: User, color: "bg-yellow-100 text-yellow-700" },
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  adjustment: "Adjustment",
  refund: "Refund",
  charge: "Charge",
  payment: "Payment",
  student: "Student",
};

export function AuditLogViewer() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
    actionType: "",
    entityType: "",
    fromDate: "",
    toDate: "",
    limit: 100,
  });

  const loadAuditLog = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: filters.limit };
      if (filters.actionType) params.actionType = filters.actionType;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      
      const data = await api.getReconciliationAuditLog(params);
      setEntries(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load audit log.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  const toggleRowExpanded = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadge = (actionType: string) => {
    const config = ACTION_TYPE_LABELS[actionType] || {
      label: actionType.replace(/_/g, " "),
      icon: Clock,
      color: "bg-gray-100 text-gray-700",
    };
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderDetails = (details: Record<string, any> | null) => {
    if (!details) return null;

    return (
      <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
        <p className="font-medium text-muted-foreground">Details:</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(details).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</dt>
              <dd className="font-medium">
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
        <Button variant="outline" size="sm" onClick={loadAuditLog}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">Action Type</Label>
            <Select
              value={filters.actionType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, actionType: value === "all" ? "" : value }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(ACTION_TYPE_LABELS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entity Type</Label>
            <Select
              value={filters.entityType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value === "all" ? "" : value }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From Date</Label>
            <Input
              type="date"
              className="h-9"
              value={filters.fromDate}
              onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To Date</Label>
            <Input
              type="date"
              className="h-9"
              value={filters.toDate}
              onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Limit</Label>
            <Select
              value={filters.limit.toString()}
              onValueChange={(value) => setFilters(prev => ({ ...prev, limit: parseInt(value) }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 entries</SelectItem>
                <SelectItem value="100">100 entries</SelectItem>
                <SelectItem value="250">250 entries</SelectItem>
                <SelectItem value="500">500 entries</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No audit entries found
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Balance Change</TableHead>
                <TableHead>Performed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <Collapsible key={entry.id} asChild open={expandedRows.has(entry.id)}>
                  <>
                    <TableRow 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRowExpanded(entry.id)}
                    >
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-0 h-auto">
                            {expandedRows.has(entry.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDateTime(entry.performedAt)}
                      </TableCell>
                      <TableCell>{getActionBadge(entry.actionType)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {ENTITY_TYPE_LABELS[entry.entityType] || entry.entityType}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {entry.entityId.substring(0, 12)}...
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.amount !== null && (
                          <span className="flex items-center justify-end gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {entry.amount.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.balanceBefore !== null && entry.balanceAfter !== null && (
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-muted-foreground">
                              ${entry.balanceBefore.toFixed(2)}
                            </span>
                            <ArrowRight className="h-3 w-3" />
                            <span className={entry.balanceAfter < entry.balanceBefore ? "text-green-600" : entry.balanceAfter > entry.balanceBefore ? "text-red-600" : ""}>
                              ${entry.balanceAfter.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {entry.performedByName || entry.performedBy}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={7} className="p-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Entity ID:</span>
                                <p className="font-mono text-xs">{entry.entityId}</p>
                              </div>
                              {entry.studentId && (
                                <div>
                                  <span className="text-muted-foreground">Student ID:</span>
                                  <p className="font-mono text-xs">{entry.studentId}</p>
                                </div>
                              )}
                              {entry.ipAddress && (
                                <div>
                                  <span className="text-muted-foreground">IP Address:</span>
                                  <p className="font-mono text-xs">{entry.ipAddress}</p>
                                </div>
                              )}
                            </div>
                            {entry.details && renderDetails(entry.details)}
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Entry count */}
      {!loading && entries.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {entries.length} audit entries
        </p>
      )}
    </div>
  );
}
