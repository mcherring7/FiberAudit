import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/top-bar";
import MetricsCards from "@/components/dashboard/metrics-cards";
import BenchmarkAnalysis from "@/components/dashboard/benchmark-analysis";
import QuickActions from "@/components/dashboard/quick-actions";
import CircuitTable from "@/components/inventory/circuit-table";
import ImportDialog from "@/components/inventory/import-dialog";
import MegaportOptimizationCard from "@/components/dashboard/megaport-optimization-card";
import MegaportAssessmentPage from "@/components/dashboard/megaport-assessment-page";

export default function Dashboard() {
  // Using the actual project ID from the storage
  const projectId = "project-1";
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showMegaportAssessment, setShowMegaportAssessment] = useState(false);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "metrics"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/metrics`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();
      
      // Map API response to expected frontend format
      return {
        totalCost: data.totalMonthlyCost,
        circuitCount: data.totalCircuits,
        highCostCircuits: data.optimizationOpportunities,
        opportunities: data.optimizationOpportunities,
        avgCostPerMbps: parseFloat(data.avgCostPerMbps)
      };
    },
  });

  const handleImport = () => {
    setShowImportDialog(true);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Export report");
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const subtitle = `${metrics.circuitCount} circuits • Last updated 2 hours ago • ${formatCurrency(127000)} potential savings identified`;

  return (
    <div className="h-full flex flex-col">
      <TopBar
        title="Enterprise Network Audit - Acme Corp"
        subtitle={subtitle}
        onImport={handleImport}
        onExport={handleExport}
      />
      
      <div className="flex-1 p-6 overflow-y-auto">
        <MetricsCards metrics={metrics} />
        
        {/* Megaport Optimization Section */}
        <div className="mt-6">
          <div onClick={() => setShowMegaportAssessment(true)} className="cursor-pointer">
            <MegaportOptimizationCard 
              totalCircuits={metrics.circuitCount}
              mplsCost={45000} // TODO: Calculate from actual MPLS circuits
              internetCost={12000} // TODO: Calculate from actual Internet circuits  
              privateCost={8000} // TODO: Calculate from actual Private circuits
            />
          </div>
        </div>
        
        <CircuitTable />
        
        <div className="mt-8 grid grid-cols-3 gap-6">
          <BenchmarkAnalysis />
          <QuickActions />
        </div>
      </div>

      <ImportDialog 
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        projectId={projectId}
      />

      {showMegaportAssessment && (
        <MegaportAssessmentPage 
          onClose={() => setShowMegaportAssessment(false)}
        />
      )}
    </div>
  );
}
