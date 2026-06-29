import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, AlertTriangle, WifiOff, Bus, Clock,
  ChevronRight, ChevronDown, ArrowLeft, User, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  kioskDriverApi,
  KioskBus,
  DriverKioskRoute,
  DriverKioskStudent,
  DriverKioskRosterResponse,
} from "@/api/api";
import BusInfoCard from "@/components/driver-kiosk/BusInfoCard";
import RouteStopsList from "@/components/driver-kiosk/RouteStopsList";
import StudentRosterItem from "@/components/driver-kiosk/StudentRosterItem";
import PaidOnlyFilter from "@/components/driver-kiosk/PaidOnlyFilter";

type KioskView = "loading" | "idle" | "routes" | "roster" | "error";

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export default function DriverKioskPage() {
  const { code } = useParams<{ code: string }>();

  const [view, setView] = useState<KioskView>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [idError, setIdError] = useState("");

  // Driver state
  const [employeeId, setEmployeeId] = useState("");
  const [employeeIdInput, setEmployeeIdInput] = useState("");
  const [driverName, setDriverName] = useState("");
  const [bus, setBus] = useState<KioskBus | null>(null);
  const [routes, setRoutes] = useState<DriverKioskRoute[]>([]);

  // Route expand state (stops accordion)
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  // Route / roster state
  const [selectedRoute, setSelectedRoute] = useState<DriverKioskRoute | null>(null);
  const [roster, setRoster] = useState<DriverKioskRosterResponse | null>(null);
  const [allStudents, setAllStudents] = useState<DriverKioskStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  // Paid-only filter state
  const [paidOnly, setPaidOnly] = useState(false);
  const [paidOnlyLoading, setPaidOnlyLoading] = useState(false);

  // Live clock
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Idle timeout
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetToIdle = useCallback(() => {
    setEmployeeId("");
    setEmployeeIdInput("");
    setDriverName("");
    setBus(null);
    setRoutes([]);
    setExpandedRouteId(null);
    setSelectedRoute(null);
    setRoster(null);
    setAllStudents([]);
    setPaidOnly(false);
    setIdError("");
    setRouteError("");
    setView("idle");
  }, []);

  const restartIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(resetToIdle, IDLE_TIMEOUT_MS);
  }, [resetToIdle]);

  // Go straight to idle — kiosk code + driverKioskModeEnabled are validated
  // on every validateDriver call, so no pre-flight check is needed here.
  useEffect(() => {
    if (!code) {
      setErrorMessage("No kiosk code provided in URL.");
      setView("error");
      return;
    }
    setView("idle");
  }, [code]);

  // Start idle timer only when driver is actively using the kiosk (routes/roster views)
  useEffect(() => {
    if (view === "routes" || view === "roster") {
      restartIdleTimer();
    } else {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    }
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [view, restartIdleTimer]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleIdSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !employeeIdInput.trim()) return;
    setIdError("");
    setIsLoading(true);
    try {
      const resolvedId = employeeIdInput.trim();
      const data = await kioskDriverApi.validate(code, resolvedId);
      setEmployeeId(resolvedId);
      setDriverName(data.driverName);
      setBus(data.bus);
      setRoutes(data.routes);

      if (data.routes.length === 1) {
        // Single route: skip the list and load the roster directly
        const singleRoute = data.routes[0];
        const rosterData = await kioskDriverApi.getRoster(code, resolvedId, singleRoute.id, false);
        setSelectedRoute(singleRoute);
        setRoster(rosterData);
        setAllStudents(rosterData.students);
        setView("roster");
      } else {
        setView("routes");
      }
    } catch (err: unknown) {
      setIdError((err as Error)?.message || "Employee ID not recognized");
    } finally {
      setIsLoading(false);
    }
  }, [code, employeeIdInput]);

  const handleRouteSelect = useCallback(async (route: DriverKioskRoute) => {
    if (!code) return;
    restartIdleTimer();
    setRouteError("");
    setPaidOnly(false);
    setIsLoading(true);
    try {
      const data = await kioskDriverApi.getRoster(code, employeeId, route.id, false);
      setSelectedRoute(route);
      setRoster(data);
      setAllStudents(data.students);
      setView("roster");
    } catch (err: unknown) {
      setRouteError((err as Error)?.message || "Unable to load roster");
    } finally {
      setIsLoading(false);
    }
  }, [code, employeeId, restartIdleTimer]);

  const handlePaidOnlyToggle = useCallback(async (value: boolean) => {
    if (!code || !selectedRoute) return;
    restartIdleTimer();
    setPaidOnly(value);
    setPaidOnlyLoading(true);
    try {
      const data = await kioskDriverApi.getRoster(code, employeeId, selectedRoute.id, value);
      setRoster(data);
      setAllStudents(data.students);
    } catch {
      // silently revert filter on error
      setPaidOnly(!value);
    } finally {
      setPaidOnlyLoading(false);
    }
  }, [code, employeeId, selectedRoute, restartIdleTimer]);

  const handleToggleRouteStops = useCallback((routeId: string) => {
    restartIdleTimer();
    setExpandedRouteId(prev => prev === routeId ? null : routeId);
  }, [restartIdleTimer]);

  const formattedTime = time.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const formattedDate = time.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Loading view ──────────────────────────────────────────────────────────

  if (view === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-gray-500 text-lg">Loading kiosk…</p>
      </div>
    );
  }

  // ── Error view ──────────────────────────────────────────────────────────────

  if (view === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-6">
          <div className="flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
            {errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("connect") ? (
              <WifiOff className="h-10 w-10 text-red-500" />
            ) : (
              <AlertTriangle className="h-10 w-10 text-red-500" />
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">Kiosk Unavailable</h2>
            <p className="text-gray-600 max-w-sm">{errorMessage}</p>
          </div>
          <Button
            size="lg"
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Idle view (Employee ID entry) ─────────────────────────────────────────

  if (view === "idle") {
    return (
      <div className="flex flex-col items-center justify-center h-screen overflow-hidden w-full bg-gradient-to-br from-slate-50 to-blue-50 px-6">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 tracking-tight">
            Driver Kiosk
          </h1>
          <p className="text-gray-500 mt-1 text-lg">{formattedDate}</p>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-3 mb-1">
          <Clock className="h-8 w-8 text-blue-500" />
          <span className="text-5xl font-mono font-semibold text-gray-800 tabular-nums">
            {formattedTime}
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-blue-600 text-lg font-semibold mb-6">
          Transport Route Kiosk
        </p>

        {/* ID Entry */}
        <div className="w-full max-w-md space-y-3">
          <p className="text-center text-gray-600 font-medium text-lg">
            Enter your Employee ID to view your routes
          </p>

          <form onSubmit={handleIdSubmit} className="space-y-3">
            <input
              type="text"
              value={employeeIdInput}
              onChange={e => setEmployeeIdInput(e.target.value.toUpperCase())}
              placeholder="e.g. EMP-001"
              autoComplete="off"
              autoFocus
              className="w-full h-16 px-4 text-2xl text-center font-mono text-gray-900 bg-white border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all tracking-widest"
            />
            <button
              type="submit"
              disabled={isLoading || !employeeIdInput.trim()}
              className="w-full h-14 text-lg font-semibold rounded-xl transition-colors shadow bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Checking…
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          {idError && (
            <div className="text-center text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm font-medium">
              {idError}
            </div>
          )}
        </div>

        <p className="absolute bottom-4 text-gray-400 text-sm">
          Type your Employee ID and press Enter
        </p>
      </div>
    );
  }

  // ── Routes view ──────────────────────────────────────────────────────────────

  if (view === "routes") {
    return (
      <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <button
              onClick={resetToIdle}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Your Routes</h2>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <User className="h-3.5 w-3.5" />
                {driverName}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 py-6">
          <div className="w-full max-w-lg mx-auto space-y-4">
            {/* Bus info card */}
            {bus ? (
              <BusInfoCard bus={bus} />
            ) : (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                <Info className="h-4 w-4 shrink-0" />
                No bus assigned yet. Contact your administrator.
              </div>
            )}

            {routeError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {routeError}
              </div>
            )}

            {routes.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
                <Bus className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-lg">No routes assigned yet.</p>
                <p className="text-sm mt-1">Contact your administrator to assign routes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {routes.map(route => (
                  <div key={route.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="flex items-center">
                      <button
                        onClick={() => handleRouteSelect(route)}
                        disabled={isLoading}
                        className="flex-1 flex items-center gap-3 p-5 min-h-[64px] hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100 shrink-0">
                          <Bus className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{route.name}</p>
                          <p className="text-sm text-gray-400">
                            {route.stops.length} stop{route.stops.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggleRouteStops(route.id)}
                        className="h-full px-4 py-5 border-l border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                        title={expandedRouteId === route.id ? "Hide stops" : "Show stops"}
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${expandedRouteId === route.id ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                    {expandedRouteId === route.id && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Stops in sequence</p>
                        <RouteStopsList stops={route.stops} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Roster view ──────────────────────────────────────────────────────────────

  if (view === "roster" && selectedRoute && roster) {
    const displayStudents = allStudents;
    const isEmpty = displayStudents.length === 0;

    return (
      <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedRoute(null);
                  setRoster(null);
                  setAllStudents([]);
                  setPaidOnly(false);
                  setView("routes");
                  restartIdleTimer();
                }}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedRoute.name}</h2>
                <p className="text-sm text-gray-500">{driverName}{roster.busName ? ` · ${roster.busName}` : ""}</p>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
              {displayStudents.length} {displayStudents.length !== 1 ? "students" : "student"}
            </span>
          </div>
        </div>

        <div className="flex-1 px-6 py-6">
          <div className="w-full max-w-lg mx-auto space-y-4">
            {/* Paid-only filter */}
            <PaidOnlyFilter
              paidOnly={paidOnly}
              onChange={handlePaidOnlyToggle}
              paidCount={roster.paidCount}
              totalCount={roster.totalCount}
            />

            {paidOnlyLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              </div>
            ) : isEmpty ? (
              <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-200">
                {paidOnly ? (
                  <>
                    <p className="text-base font-medium text-gray-700">No paid students found</p>
                    <p className="text-sm mt-1 text-gray-400">No students on this route have paid transport fees.</p>
                  </>
                ) : (
                  <p>No active students on this route.</p>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 shadow-sm">
                {displayStudents.map((student, i) => (
                  <StudentRosterItem
                    key={student.id}
                    student={student}
                    index={i}
                    showPaymentStatus={!paidOnly}
                  />
                ))}
              </div>
            )}

            <p className="text-center text-sm text-gray-400">
              {displayStudents.length} student{displayStudents.length !== 1 ? "s" : ""}
              {paidOnly ? " (paid only)" : ` · ${roster.paidCount} paid`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
