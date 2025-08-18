import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/top-bar";
import MetricsCards from "@/components/dashboard/metrics-cards";
import BenchmarkAnalysis from "@/components/dashboard/benchmark-analysis";
import QuickActions from "@/components/dashboard/quick-actions";
import CircuitTable from "@/components/inventory/circuit-table";
import ImportDialog from "@/components/inventory/import-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowRight } from "lucide-react";

export default function Dashboard() {
  // Get current project ID from localStorage
  const projectId = localStorage.getItem('currentProjectId') || "project-1";
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "metrics"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/metrics`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();

      // Map API response to expected frontend format with fallbacks
      return {
        totalCost: data.totalMonthlyCost || 0,
        circuitCount: data.totalCircuits || 0,
        highCostCircuits: data.highCostCircuits || 0,
        opportunities: data.optimizationOpportunities || 0,
        avgCostPerMbps: parseFloat(data.avgCostPerMbps) || 0
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

        {/* Optimization Section */}
        {metrics.circuitCount > 0 && (
          <div className="mt-6">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-green-900">Network Optimization</CardTitle>
                      <p className="text-sm text-green-700">Identify cost savings and performance improvements</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-900">{formatCurrency(metrics.totalCost * 0.3)}</div>
                    <div className="text-xs text-green-700">Potential Annual Savings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-900">{metrics.opportunities}</div>
                    <div className="text-xs text-green-700">Optimization Opportunities</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-900">{Math.round((metrics.totalCost * 0.3) / metrics.totalCost * 100)}%</div>
                    <div className="text-xs text-green-700">Projected Cost Reduction</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
    </div>
  );
}