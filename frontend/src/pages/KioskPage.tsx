import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kioskApi, KioskStatusResponse, KioskActionResult } from "@/api/api";
import { KioskIdleScreen } from "@/components/kiosk/KioskIdleScreen";
import { KioskIdleScreenWithQR } from "@/components/kiosk/KioskIdleScreenWithQR";
import { KioskConfirmation } from "@/components/kiosk/KioskConfirmation";

type KioskView = "idle" | "processing" | "confirmation" | "error";

export default function KioskPage() {
  // New format: /kiosk/:code
  const { code } = useParams<{ code?: string }>();
  // Legacy fallback: /kiosk?tenant_id=xxx
  const [searchParams] = useSearchParams();
  const legacyTenantId = searchParams.get("tenant_id") ?? "";

  const kioskCode = code ?? "";
  const useLegacy = !kioskCode && !!legacyTenantId;
  const resolvedIdentifier = kioskCode || legacyTenantId;

  const [view, setView] = useState<KioskView>("idle");
  const [statusData, setStatusData] = useState<KioskStatusResponse | null>(null);
  const [actionResult, setActionResult] = useState<KioskActionResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!resolvedIdentifier) {
      setLoadError("No kiosk code found in URL. Please use the URL provided by your administrator.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await kioskApi.getKioskStatus(resolvedIdentifier, useLegacy);
      if (!data.kioskEnabled) {
        setLoadError("Kiosk mode is not enabled for this school. Please contact your administrator.");
        setLoading(false);
        return;
      }
      setStatusData(data);
    } catch (err: any) {
      // 404 means invalid kiosk code
      if (err?.status === 404) {
        setLoadError("Kiosk not found. Please check the URL and try again.");
      } else {
        setLoadError(err?.message || "Failed to load kiosk. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }, [resolvedIdentifier, useLegacy]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleEmployeeIdSubmit = async (employeeId: string) => {
    setIdError(null);
    setView("processing");
    try {
      const result = await kioskApi.postKioskAction({
        kiosk_code: resolvedIdentifier,
        employee_id: employeeId,
      });
      setActionResult(result);
      setView("confirmation");
    } catch (err: any) {
      const msg = err?.message || "Something went wrong. Please try again.";
      setIdError(msg);
      setView("idle");
    }
  };

  const handleDone = useCallback(() => {
    setActionResult(null);
    setIdError(null);
    setView("idle");
  }, []);

  // ── Fatal load error or kiosk disabled ──────────────────────────────────────
  if (!loading && loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-6">
          <div className="flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">Kiosk Unavailable</h2>
            <p className="text-gray-600 max-w-sm">{loadError}</p>
          </div>
          <Button
            size="lg"
            onClick={fetchStatus}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Initial load spinner ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-gray-500 text-lg">Loading kiosk…</p>
      </div>
    );
  }

  // ── Processing spinner ──────────────────────────────────────────────────────
  if (view === "processing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-gray-500 text-lg">Processing…</p>
      </div>
    );
  }

  // ── Confirmation screen ─────────────────────────────────────────────────────
  if (view === "confirmation" && actionResult) {
    return <KioskConfirmation result={actionResult} onDone={handleDone} />;
  }

  // ── Idle screen (default) ───────────────────────────────────────────────────
  return (
    <KioskIdleScreenWithQR
      schoolName={statusData?.schoolName ?? ""}
      workHours={statusData?.workHours ?? null}
      onSubmit={handleEmployeeIdSubmit}
      errorMessage={idError ?? undefined}
    />
  );
}
