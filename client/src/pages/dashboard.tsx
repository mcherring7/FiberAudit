import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/top-bar";
import MetricsCards from "@/components/dashboard/metrics-cards";
import BenchmarkAnalysis from "@/components/dashboard/benchmark-analysis";
import QuickActions from "@/components/dashboard/quick-actions";
import CircuitTable from "@/components/inventory/circuit-table";

export default function Dashboard() {
  // For demo purposes, using a mock project ID
  const projectId = "demo-project-1";

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "metrics"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/metrics`);
      if (!response.ok) {
        // Return demo data if project doesn't exist yet
        return {
          totalCost: 284750,
          circuitCount: 847,
          highCostCircuits: 23,
          opportunities: 15,
          avgCostPerMbps: 12.45
        };
      }
      return response.json();
    },
  });

  const handleImport = () => {
    // TODO: Implement file import functionality
    console.log("Import data");
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
        
        <CircuitTable />
        
        <div className="mt-8 grid grid-cols-3 gap-6">
          <BenchmarkAnalysis />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
