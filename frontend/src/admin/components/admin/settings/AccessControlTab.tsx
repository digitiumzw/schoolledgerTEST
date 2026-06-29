import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Cell = "full" | "view" | "none" | string;

const ROWS: Array<{ section: string; cells: [Cell, Cell, Cell, Cell] }> = [
  { section: "Dashboard (read)",                       cells: ["full", "full", "full", "full"] },
  { section: "Schools — view list & detail",           cells: ["full", "full", "full", "full"] },
  { section: "Schools — create",                       cells: ["full", "full", "none", "none"] },
  { section: "Schools — suspend / reactivate / impersonate", cells: ["full", "full", "none", "full"] },
  { section: "Schools — permanent delete",             cells: ["full", "none", "none", "none"] },
  { section: "Plans — view",                           cells: ["full", "full", "full", "full"] },
  { section: "Plans / Subscriptions — write",          cells: ["full", "full", "full", "none"] },
  { section: "Finance — view",                         cells: ["full", "full", "full", "full"] },
  { section: "Finance — export & invoice actions",     cells: ["full", "full", "full", "none"] },
  { section: "Analytics (read)",                       cells: ["full", "full", "full", "full"] },
  { section: "Settings — Account (own)",               cells: ["full", "full", "full", "full"] },
  { section: "Settings — General/Email — write",       cells: ["full", "full", "none", "none"] },
  { section: "Settings — Team — view",                 cells: ["full", "full", "full", "full"] },
  { section: "Settings — Team — invite/deactivate/remove", cells: ["full", "full", "none", "none"] },
  { section: "Settings — Team — change role",          cells: ["full", "none", "none", "none"] },
  { section: "Settings — Access Control (read)",       cells: ["full", "full", "full", "full"] },
  { section: "Settings — Security — history",          cells: ["full", "full", "full", "full"] },
  { section: "Settings — Security — platform toggles", cells: ["full", "none", "none", "none"] },
  { section: "Settings — Audit Logs (read + export)",  cells: ["full", "full", "full", "full"] },
  { section: "Settings — API Keys (view)",             cells: ["full", "full", "none", "none"] },
  { section: "Settings — API Keys (create/rotate/revoke)", cells: ["full", "none", "none", "none"] },
];

function renderCell(c: Cell) {
  if (c === "full") return <span className="text-emerald-600">●</span>;
  if (c === "view") return <span className="text-amber-600">○</span>;
  if (c === "none") return <span className="text-muted-foreground">—</span>;
  return <span className="text-xs text-muted-foreground">{c}</span>;
}

export function AccessControlTab() {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Role-permission matrix</CardTitle>
        <p className="text-xs text-muted-foreground">
          ● Full access · ○ Limited · — None. This view is read-only.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section / Action</TableHead>
                <TableHead className="text-center">Owner</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                <TableHead className="text-center">Finance</TableHead>
                <TableHead className="text-center">Support</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((r) => (
                <TableRow key={r.section}>
                  <TableCell className="text-sm">{r.section}</TableCell>
                  {r.cells.map((c, i) => (
                    <TableCell key={i} className="text-center">{renderCell(c)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
