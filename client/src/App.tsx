
import React from "react";
import { Switch, Route, useLocation } from "wouter";
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
  const [location, setLocation] = useLocation();

  // Extract project ID from URL
  const pathParts = location.split('/');
  const projectIndex = pathParts.indexOf('projects');
  const currentProjectId = projectIndex !== -1 && projectIndex < pathParts.length - 1 
    ? pathParts[projectIndex + 1] 
    : null;

  const handleSelectProject = (projectId: string) => {
    setLocation(`/projects/${projectId}`);
  };

  const handleBackToProjects = () => {
    setLocation('/');
  };

  // If no project in URL, show project landing
  if (!currentProjectId && !location.startsWith('/projects/')) {
    return <ProjectLanding onSelectProject={handleSelectProject} />;
  }

  // If we have a project ID, show the main app
  if (currentProjectId) {
    return (
      <div className="flex min-h-screen">
        <Sidebar onBackToProjects={handleBackToProjects} currentProjectId={currentProjectId} />
        <main className="flex-1">
          <Switch>
            <Route path={`/projects/${currentProjectId}`} component={Dashboard} />
            <Route path={`/projects/${currentProjectId}/inventory`} component={Inventory} />
            <Route path={`/projects/${currentProjectId}/sites`} component={Sites} />
            <Route path={`/projects/${currentProjectId}/optimization`} component={Optimization} />
            <Route path={`/projects/${currentProjectId}/audit-flags`} component={AuditFlags} />
            <Route path={`/projects/${currentProjectId}/report-builder`} component={ReportBuilder} />
            <Route path={`/projects/${currentProjectId}/benchmark-settings`} component={BenchmarkSettings} />
            <Route path={`/projects/${currentProjectId}/network-topology`} component={NetworkTopologyPage} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    );
  }

  // Fallback to project landing
  return <ProjectLanding onSelectProject={handleSelectProject} />;
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
