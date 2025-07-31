import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import AuditFlags from "@/pages/audit-flags";
import ReportBuilder from "@/pages/report-builder";
import BenchmarkSettings from "@/pages/benchmark-settings";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/audit-flags" component={AuditFlags} />
          <Route path="/report-builder" component={ReportBuilder} />
          <Route path="/benchmark-settings" component={BenchmarkSettings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
