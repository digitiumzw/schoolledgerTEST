import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Settings, Users, Calendar, Menu, Receipt, Scale, UserCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const settingsGroups = [
  {
    label: "School",
    links: [
      { to: "/settings/general", label: "General", icon: Settings, roles: ['super_admin', 'admin'] },
      { to: "/settings/calendar", label: "Academic Calendar", icon: Calendar, roles: ['super_admin', 'admin'] },
    ],
  },
  {
    label: "Access",
    links: [
      { to: "/settings/users", label: "User Accounts", icon: Users, roles: ['super_admin', 'admin'] },
    ],
  },
  {
    label: "Account",
    links: [
      { to: "/settings/account", label: "Account Settings", icon: UserCircle, roles: ['super_admin'] },
    ],
  },
];

export function SettingsSidebar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const SidebarContent = () => (
    <nav className="space-y-5">
      {settingsGroups.map((group) => {
        const visibleLinks = group.links.filter(link => user?.role && link.roles.includes(user.role));
        if (visibleLinks.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {visibleLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  activeClassName="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  onClick={() => setOpen(false)}
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile navigation trigger */}
      <div className="lg:hidden mb-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Menu className="h-4 w-4" />
              Menu
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 pt-10">
            <SheetTitle className="sr-only">Settings Navigation</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-52 shrink-0 border-r border-border pr-6">
        <div className="sticky top-6">
          <SidebarContent />
        </div>
      </aside>
    </>
  );
}
