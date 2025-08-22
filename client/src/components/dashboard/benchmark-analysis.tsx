import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lightbulb, TrendingUp, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Minimal types used by this component
type Circuit = {
  circuitId: string;
  monthlyCost: number;
  bandwidth: number;
  circuitType?: string | null;
  provider?: string | null;
  contractEndDate?: string | null;
};

type Site = {
  id: string;
};

type AlertItem = {
  type: "high-cost" | "opportunity" | "renewal";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  current: string;
  benchmark: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
};

export default function BenchmarkAnalysis() {
  // Get current project ID from localStorage
  const projectId = localStorage.getItem('currentProjectId') || "project-1";

  const { data: circuits = [], isLoading } = useQuery<Circuit[]>({
    queryKey: ["/api/circuits", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/circuits?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch circuits');
      }
      return response.json();
    },
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/sites?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sites');
      }
      return response.json();
    },
  });

  // Generate alerts based on actual data
  const generateAlerts = (): AlertItem[] => {
    const alerts: AlertItem[] = [];

    if (circuits.length === 0) {
      return [];
    }

    // Find high-cost circuits (above $10/Mbps)
    const highCostCircuits = circuits.filter(circuit => {
      const costPerMbps = circuit.monthlyCost / (circuit.bandwidth || 1);
      return costPerMbps > 10;
    });

    if (highCostCircuits.length > 0) {
      const worstCircuit = highCostCircuits.reduce((worst, current) => {
        const worstCost = worst.monthlyCost / (worst.bandwidth || 1);
        const currentCost = current.monthlyCost / (current.bandwidth || 1);
        return currentCost > worstCost ? current : worst;
      });

      const costPerMbps = (worstCircuit.monthlyCost / (worstCircuit.bandwidth || 1)).toFixed(2);
      alerts.push({
        type: "high-cost",
        icon: AlertTriangle,
        title: "High Cost Alert",
        description: `${worstCircuit.circuitId} is above market benchmark`,
        current: `$${costPerMbps}/Mbps`,
        benchmark: "$8.50/Mbps",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        iconColor: "text-red-600",
      });
    }

    // Check for MPLS circuits that could be optimized
    const mplsCircuits = circuits.filter(circuit => 
      circuit.circuitType?.toLowerCase().includes('mpls') || 
      circuit.provider?.toLowerCase().includes('mpls')
    );

    if (mplsCircuits.length > 0) {
      const potentialSavings = mplsCircuits.reduce((sum, circuit) => sum + (circuit.monthlyCost * 0.3), 0);
      alerts.push({
        type: "opportunity",
        icon: Lightbulb,
        title: "Optimization Opportunity",
        description: `Consider SD-WAN migration for ${mplsCircuits.length} MPLS circuits`,
        current: "Potential Savings:",
        benchmark: `$${Math.round(potentialSavings).toLocaleString()}/month`,
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        iconColor: "text-green-600",
      });
    }

    // Check for circuits expiring soon (within 90 days)
    const today = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(today.getDate() + 90);

    const expiringCircuits = circuits.filter(circuit => {
      if (!circuit.contractEndDate) return false;
      const endDate = new Date(circuit.contractEndDate);
      return endDate >= today && endDate <= ninetyDaysFromNow;
    });

    if (expiringCircuits.length > 0) {
      const renewalValue = expiringCircuits.reduce((sum, circuit) => sum + circuit.monthlyCost, 0);
      alerts.push({
        type: "renewal",
        icon: TrendingUp,
        title: "Contract Renewal Alert",
        description: `${expiringCircuits.length} circuits expiring in next 90 days`,
        current: "Renewal Value:",
        benchmark: `$${Math.round(renewalValue * 12 / 1000)}K/year`,
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        iconColor: "text-yellow-600",
      });
    }

    return alerts;
  };

  const alerts = generateAlerts();

  if (isLoading) {
    return (
      <Card className="col-span-2 border-neutral-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Benchmark Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2 border-neutral-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Benchmark Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Available</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              {circuits.length === 0 
                ? "Add circuits to your project to see benchmark analysis and optimization opportunities."
                : "Analysis will appear here once enough data is available for comparison."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {alerts.map((alert) => (
              <div
                key={alert.type}
                className={`flex items-center justify-between p-4 ${alert.bgColor} rounded-lg border ${alert.borderColor}`}
              >
                <div className="flex items-center space-x-4">
                  <alert.icon className={`w-5 h-5 ${alert.iconColor}`} />
                  <div>
                    <h4 className="font-medium text-foreground">{alert.title}</h4>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {alert.current} <span className={`font-medium ${alert.iconColor}`}>{alert.benchmark}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
