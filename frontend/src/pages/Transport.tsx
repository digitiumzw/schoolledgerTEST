import { useEffect, useState } from "react";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { useNavigate } from "react-router-dom";
import { TransportRoute, TransportVehicle, TransportDriver } from "@/types/dashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/useDebounce";
import { MobileActionMenu, DropdownMenuItem } from "@/components/MobileActionMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { api } from "@/api/api";
import { useTransportRoutes, useTransportVehicles, useTransportDrivers, useInvalidateTransport } from "@/hooks/useTransportCatalogue";
import {
  Plus, Search, Bus, Users, DollarSign, Phone, MoreHorizontal, Eye, Edit, Trash2, MapPin,
  AlertCircle, Car, UserCheck, Hash, Gauge, Shield,
  GraduationCap, HelpCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RouteFormModal } from "@/components/modals/RouteFormModal";
import { DeleteRouteModal } from "@/components/modals/DeleteRouteModal";
import { VehicleFormModal } from "@/components/modals/VehicleFormModal";
import { DriverFormModal } from "@/components/modals/DriverFormModal";
import { MissingChargeAlert } from "@/components/transport/MissingChargeAlert";
import ContextualHelpLink from "@/components/help/ContextualHelpLink";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem as DropdownItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function Transport() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [activeTab, setActiveTab] = useState("routes");

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("transport-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("transport-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showDeleteRouteModal, setShowDeleteRouteModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<TransportRoute | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<TransportRoute | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<TransportVehicle | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<TransportDriver | null>(null);

  const searchParams = { search: debouncedSearchTerm || undefined };
  const routesQuery = useTransportRoutes(searchParams);
  const vehiclesQuery = useTransportVehicles(searchParams);
  const driversQuery = useTransportDrivers(searchParams);
  const invalidateTransport = useInvalidateTransport();

  const filteredRoutes: TransportRoute[] = (routesQuery.data?.data ?? []) as TransportRoute[];
  const filteredVehicles: TransportVehicle[] = (vehiclesQuery.data?.data ?? []) as TransportVehicle[];
  const filteredDrivers: TransportDriver[] = (driversQuery.data?.data ?? []) as TransportDriver[];
  const loading = routesQuery.isLoading || vehiclesQuery.isLoading || driversQuery.isLoading;
  const fetchError = routesQuery.isError || vehiclesQuery.isError || driversQuery.isError
    ? "Could not load transport data. Check your connection."
    : null;

  const fetchData = () => invalidateTransport();

  const handleDeleteRoute = (route: TransportRoute) => {
    setRouteToDelete(route);
    setShowDeleteRouteModal(true);
  };

  const handleDeleteVehicle = async (vehicle: TransportVehicle) => {
    if (!confirm(`Delete vehicle "${vehicle.name}"?`)) return;
    try {
      await api.deleteVehicle(vehicle.id);
      toast.success("Vehicle deleted");
      invalidateTransport();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete vehicle"); }
  };

  const handleDeleteDriver = async (driver: TransportDriver) => {
    if (!confirm(`Delete driver "${driver.name}"?`)) return;
    try {
      await api.deleteDriver(driver.id);
      toast.success("Driver deleted");
      invalidateTransport();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete driver"); }
  };

  const addButton = (
    <Button onClick={() => {
      setSelectedRoute(null); setSelectedVehicle(null); setSelectedDriver(null);
      if (activeTab === "routes") setShowRouteModal(true);
      else if (activeTab === "vehicles") setShowVehicleModal(true);
      else setShowDriverModal(true);
    }}>
      <Plus className="mr-2 h-4 w-4" />
      {activeTab === "routes" ? "New Route" : activeTab === "vehicles" ? "Add Vehicle" : "Add Driver"}
    </Button>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-5 w-full" />
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="border-b px-4 py-3.5">
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <SubscriptionGuard>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Transport</h1>
            <p className="text-sm text-muted-foreground">{filteredRoutes.length} route{filteredRoutes.length !== 1 ? "s" : ""} · {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? "s" : ""} · {filteredDrivers.length} driver{filteredDrivers.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <ContextualHelpLink sectionId="transport" label="Transport Help" />
            <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)} className="hidden sm:flex">
              <HelpCircle className="h-4 w-4 mr-2" />
              Transport guide
            </Button>
            <div className="hidden sm:block">{addButton}</div>
          </div>
        </div>

        {fetchError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}

        {/* Feature 054 / US5: Missing transport charge alert */}
        <MissingChargeAlert />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <TabsList>
              <TabsTrigger value="routes" className="gap-1.5">
                <Bus className="h-3.5 w-3.5" /> Routes ({filteredRoutes.length})
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="gap-1.5">
                <Car className="h-3.5 w-3.5" /> Vehicles ({filteredVehicles.length})
              </TabsTrigger>
              <TabsTrigger value="drivers" className="gap-1.5">
                <UserCheck className="h-3.5 w-3.5" /> Drivers ({filteredDrivers.length})
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="sm:hidden">{addButton}</div>
            </div>
          </div>

          {/* ── ROUTES ─────────────────────────────────────────────────────── */}
          <TabsContent value="routes" className="mt-4">
            {filteredRoutes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Bus className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">{searchTerm ? "No routes match your search" : "No routes yet"}</p>
                {!searchTerm && <p className="text-sm mt-1">Create your first route to get started.</p>}
              </div>
            ) : isMobile ? (
              <div className="rounded-lg border border-border bg-card divide-y">
                {filteredRoutes.map(route => (
                  <div key={route.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bus className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{route.routeName}</p>
                          <Badge variant={route.status === "active" ? "secondary" : "outline"} className="text-xs mt-0.5">
                            {route.status}
                          </Badge>
                        </div>
                      </div>
                      <MobileActionMenu>
                        <DropdownMenuItem onSelect={() => navigate(`/transport/routes/${route.id}`)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { setSelectedRoute(route); setShowRouteModal(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDeleteRoute(route)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </MobileActionMenu>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{route.activeCount ?? 0} students</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{route.stopCount} stops</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>${route.monthlyFee.toFixed(2)}/mo</span>
                      </div>
                      {route.vehicle && (
                        <div className="flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{route.vehicle.name}</span>
                        </div>
                      )}
                      {route.driver && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{route.driver.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px]">Route Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead className="text-center">Stops</TableHead>
                      <TableHead className="text-right">Monthly Fee</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoutes.map(route => (
                      <TableRow
                        key={route.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/transport/routes/${route.id}`)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Bus className="h-4 w-4 text-primary" />
                            </div>
                            <span className="break-words whitespace-normal">{route.routeName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={route.status === "active" ? "secondary" : "outline"} className="text-xs capitalize">
                            {route.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {route.activeCount ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {route.stopCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          ${route.monthlyFee.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {route.vehicle ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Car className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{route.vehicle.name}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {route.driver ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{route.driver.name}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownItem onClick={() => navigate(`/transport/routes/${route.id}`)}><Eye className="h-4 w-4 mr-2" />View Details</DropdownItem>
                              <DropdownItem onClick={() => { setSelectedRoute(route); setShowRouteModal(true); }}><Edit className="h-4 w-4 mr-2" />Edit Route</DropdownItem>
                              <DropdownMenuSeparator />
                              <DropdownItem onClick={() => handleDeleteRoute(route)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── VEHICLES ───────────────────────────────────────────────────── */}
          <TabsContent value="vehicles" className="mt-4">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Car className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">{searchTerm ? "No vehicles match your search" : "No vehicles yet"}</p>
                {!searchTerm && <p className="text-sm mt-1">Add your fleet vehicles to assign them to routes.</p>}
              </div>
            ) : isMobile ? (
              <div className="rounded-lg border border-border bg-card divide-y">
                {filteredVehicles.map(v => (
                  <div key={v.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Car className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{v.name}</p>
                          <Badge variant="outline" className="text-xs capitalize mt-0.5">{v.type}</Badge>
                        </div>
                      </div>
                      <MobileActionMenu>
                        <DropdownMenuItem onSelect={() => { setSelectedVehicle(v); setShowVehicleModal(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDeleteVehicle(v)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </MobileActionMenu>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      {v.regNumber && (
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{v.regNumber}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Cap. {v.capacity}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{v.activeAllocations ?? 0} alloc.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={v.status === "active" ? "secondary" : "outline"} className="text-xs capitalize">{v.status}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">Vehicle</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reg. Number</TableHead>
                      <TableHead className="text-center">Capacity</TableHead>
                      <TableHead className="text-center">Allocations</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map(v => (
                      <TableRow key={v.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                              <Car className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="truncate">{v.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{v.type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.regNumber ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Hash className="h-3.5 w-3.5 flex-shrink-0" />
                              {v.regNumber}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Gauge className="h-3.5 w-3.5" />
                            {v.capacity}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {v.activeAllocations ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.status === "active" ? "secondary" : "outline"} className="text-xs capitalize">
                            {v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownItem onClick={() => { setSelectedVehicle(v); setShowVehicleModal(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownItem>
                              <DropdownMenuSeparator />
                              <DropdownItem onClick={() => handleDeleteVehicle(v)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── DRIVERS ────────────────────────────────────────────────────── */}
          <TabsContent value="drivers" className="mt-4">
            {filteredDrivers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">{searchTerm ? "No drivers match your search" : "No drivers yet"}</p>
                {!searchTerm && <p className="text-sm mt-1">Add drivers to assign them to routes.</p>}
              </div>
            ) : isMobile ? (
              <div className="rounded-lg border border-border bg-card divide-y">
                {filteredDrivers.map(d => (
                  <div key={d.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <UserCheck className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{d.name}</p>
                          <Badge variant={d.status === "active" ? "secondary" : "outline"} className="text-xs mt-0.5 capitalize">{d.status}</Badge>
                        </div>
                      </div>
                      <MobileActionMenu>
                        <DropdownMenuItem onSelect={() => { setSelectedDriver(d); setShowDriverModal(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDeleteDriver(d)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </MobileActionMenu>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      {d.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{d.phone}</span>
                        </div>
                      )}
                      {d.licenseNumber && (
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{d.licenseNumber}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Bus className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{d.activeRoutes ?? 0} routes</span>
                      </div>
                      {d.staffId && (
                        <Badge variant="outline" className="text-xs">Linked to staff</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">Driver</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead className="text-center">Active Routes</TableHead>
                      <TableHead>Staff Link</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDrivers.map(d => (
                      <TableRow key={d.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                              <UserCheck className="h-4 w-4 text-green-600" />
                            </div>
                            <span className="truncate">{d.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.phone ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                              {d.phone}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d.licenseNumber ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{d.licenseNumber}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Bus className="h-3.5 w-3.5" />
                            {d.activeRoutes ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          {d.staffId ? (
                            <Badge variant="outline" className="text-xs">Linked to staff</Badge>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={d.status === "active" ? "secondary" : "outline"} className="text-xs capitalize">
                            {d.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownItem onClick={() => { setSelectedDriver(d); setShowDriverModal(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownItem>
                              <DropdownMenuSeparator />
                              <DropdownItem onClick={() => handleDeleteDriver(d)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Transport
            </DialogTitle>
            <DialogDescription>
              How to manage routes, vehicles, drivers, and transport billing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Routes", "Create routes with a name, monthly fee, and ordered stops. Routes define the path students travel and the amount they are charged each month.", Bus],
              ["2", "Vehicles", "Add fleet vehicles with capacity and registration details. Link a vehicle to a route so students and parents know which bus to board.", Car],
              ["3", "Drivers", "Register drivers with contact and license information. Assign a driver to a route for operational clarity and accountability.", UserCheck],
              ["4", "Student Assignments", "Assign students to routes with a mandatory stop selection. Each student can only be on one active route at a time for safety and billing clarity.", Users],
              ["5", "Generate Charges", "After confirming assignments, go to Settings → Billing to generate monthly transport charges. Only active route allocations are billed.", DollarSign],
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
                id="tr-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="tr-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RouteFormModal
        open={showRouteModal}
        onOpenChange={setShowRouteModal}
        onSuccess={fetchData}
        mode={selectedRoute ? "edit" : "create"}
        route={selectedRoute}
      />
      <DeleteRouteModal
        open={showDeleteRouteModal}
        onOpenChange={setShowDeleteRouteModal}
        route={routeToDelete}
        onSuccess={fetchData}
      />
      <VehicleFormModal
        open={showVehicleModal}
        onOpenChange={setShowVehicleModal}
        onSuccess={fetchData}
        vehicle={selectedVehicle}
      />
      <DriverFormModal
        open={showDriverModal}
        onOpenChange={setShowDriverModal}
        onSuccess={fetchData}
        driver={selectedDriver}
      />
    </SubscriptionGuard>
  );
}
