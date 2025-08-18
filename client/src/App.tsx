import React, { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Sites from "@/pages/sites";
import AuditFlags from "@/pages/audit-flags";
import ReportBuilder from "@/pages/report-builder";
import BenchmarkSettings from "@/pages/benchmark-settings";
import NetworkTopologyPage from "@/pages/network-topology";
import Optimization from "@/pages/optimization";
import NotFound from "@/pages/not-found";
import ProjectLanding from "@/pages/project-landing";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    // Initialize from localStorage
    return localStorage.getItem('currentProjectId');
  });

  const handleSelectProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    // Store the project ID in localStorage for persistence
    localStorage.setItem('currentProjectId', projectId);
  };

  const handleBackToProjects = () => {
    setCurrentProjectId(null);
    localStorage.removeItem('currentProjectId');
  };

  // Check if we have a current project or should show landing page
  if (!currentProjectId) {
    return <ProjectLanding onSelectProject={handleSelectProject} />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar onBackToProjects={handleBackToProjects} currentProjectId={currentProjectId} />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/sites" component={Sites} />
          <Route path="/optimization" component={Optimization} />
          <Route path="/audit-flags" component={AuditFlags} />
          <Route path="/report-builder" component={ReportBuilder} />
          <Route path="/benchmark-settings" component={BenchmarkSettings} />
          <Route path="/network-topology" component={NetworkTopologyPage} />
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