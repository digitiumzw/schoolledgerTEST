import { useRef, useState } from "react";
import { Moon, Sun, LogOut, Search, X, Building2, CreditCard, BarChart3, LayoutDashboard, Wallet, Settings as SettingsIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useAuth } from "../../contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const BASE = "/platform-control-panel";

// Quick-navigation shortcuts shown in the search results when no query
const navItems = [
  { label: "Dashboard",     icon: LayoutDashboard, href: BASE,                    hint: "Platform overview" },
  { label: "Schools",       icon: Building2,  href: `${BASE}/schools`,       hint: "Manage tenants" },
  { label: "Subscriptions", icon: CreditCard, href: `${BASE}/subscriptions`, hint: "Plans & billing" },
  { label: "Finance",       icon: Wallet,     href: `${BASE}/finance`,       hint: "Revenue & invoices" },
  { label: "Analytics",     icon: BarChart3,  href: `${BASE}/analytics`,     hint: "Growth metrics" },
  { label: "Settings",      icon: SettingsIcon, href: `${BASE}/settings`,     hint: "Configuration & team" },
];

function pageTitle(pathname: string): string {
  const rest = pathname.replace(BASE, "").replace(/^\/+/, "");
  if (!rest) return "Dashboard";
  const seg = rest.split("/")[0];
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

function initials(name?: string): string {
  if (!name) return "PA";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "PA"
  );
}

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const { user, logout }    = useAuth();
  const navigate            = useNavigate();
  const location            = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query,      setQuery]      = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }

  function go(href: string) {
    navigate(href);
    closeSearch();
  }

  const filtered = query.trim()
    ? navItems.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()) || n.hint.toLowerCase().includes(query.toLowerCase()))
    : navItems;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4">
        <SidebarTrigger className="-ml-1" />

        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">{pageTitle(location.pathname)}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Global search */}
            {searchOpen ? (
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); if (e.key === "Enter" && filtered.length) go(filtered[0].href); }}
                  placeholder="Jump to…"
                  className="h-9 w-52 pl-9 pr-8 text-sm"
                />
                <button
                  onClick={closeSearch}
                  className="absolute right-2 text-muted-foreground hover:text-foreground"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
                {/* Dropdown results */}
                <div className="absolute left-0 top-full mt-1 w-64 rounded-lg border bg-popover shadow-lg">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
                  ) : (
                    filtered.map((item) => (
                      <button
                        key={item.href}
                        onClick={() => go(item.href)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                      >
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.hint}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={openSearch} aria-label="Search">
                <Search className="h-5 w-5" />
              </Button>
            )}

            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-muted"
                  aria-label="Account menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(user?.name)}
                  </span>
                  <span className="hidden text-sm font-medium text-foreground sm:inline">{user?.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{user?.name ?? "Platform Admin"}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
                  {user?.platform_role && (
                    <Badge variant="secondary" className="mt-1 w-fit text-[10px]">{user.platform_role}</Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`${BASE}/settings`)}>
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
