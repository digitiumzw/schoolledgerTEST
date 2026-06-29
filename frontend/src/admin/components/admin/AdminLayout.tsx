import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { GlobalTopLoader } from "@/components/ui/global-top-loader";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <GlobalTopLoader />
          <TopBar />
          <NetworkStatusBanner />
          <main className="flex-1 bg-muted/30">
            <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
