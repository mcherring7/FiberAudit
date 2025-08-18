import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import MegaportOptimizationCard from "@/components/dashboard/megaport-optimization-card";
import MegaportAssessmentPage from "@/components/dashboard/megaport-assessment-page";

// Network layout optimization algorithms
interface Node {
  type: string;
  x: number;
  y: number;
}

interface LayoutData {
  nodes: Node[];
}

function applyFlattenedLayout(data: LayoutData) {
  // Split nodes into groups
  const hyperscalers = data.nodes.filter((n: Node) => n.type === "hyperscaler" || n.type === "app");
  const megaportPops = data.nodes.filter((n: Node) => n.type === "megaport_pop");
  const customerSites = data.nodes.filter((n: Node) => n.type === "customer_site");

  // Assign fixed y-positions for each layer
  const layerPositions = {
    hyperscaler: 100,   // top
    app: 100,           // same as hyperscaler
    megaport_pop: 300,  // middle
    customer_site: 500  // bottom
  };

  // For each layer, spread nodes horizontally
  const spreadLayer = (nodes: Node[], y: number) => {
    const spacing = 200;
    const startX = -(nodes.length - 1) * spacing / 2;
    nodes.forEach((node: Node, i: number) => {
      node.x = startX + i * spacing;
      node.y = y;
    });
  };

  spreadLayer(hyperscalers, layerPositions.hyperscaler);
  spreadLayer(megaportPops, layerPositions.megaport_pop);
  spreadLayer(customerSites, layerPositions.customer_site);

  return data;
}

export default function OptimizationPage() {
  const [showMegaportAssessment, setShowMegaportAssessment] = useState(false);

  // Get current project ID from URL
  const currentProjectId = window.location.pathname.includes('/projects/') 
    ? window.location.pathname.split('/projects/')[1]?.split('/')[0] 
    : null;

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["/api/projects", currentProjectId, "metrics"],
    queryFn: async () => {
      if (!currentProjectId) {
        throw new Error('No project selected');
      }

      const response = await fetch(`/api/projects/${currentProjectId}/metrics`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();

      return {
        totalCost: data.totalMonthlyCost,
        circuitCount: data.totalCircuits,
        highCostCircuits: data.optimizationOpportunities,
        opportunities: data.optimizationOpportunities,
        avgCostPerMbps: parseFloat(data.avgCostPerMbps)
      };
    },
    enabled: !!currentProjectId
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading optimization analysis...</p>
        </div>
      </div>
    );
  }

  // Show empty state if no metrics or no circuits
  if (!metrics || metrics.circuitCount === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Network Optimization</h1>
                <p className="text-sm text-gray-600">
                  Identify cost savings and performance improvements for your telecom infrastructure
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                "You can't optimize what you don't measure."
              </h2>
              <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full">
                <span className="text-lg">🔍</span>
                <span className="font-medium">Network Optimization Insights (coming soon)</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-8 text-left">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Our audit process typically identifies opportunities in areas such as:
              </h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span><strong>Cost per Mbps</strong> – benchmarking against market rates</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span><strong>Contract terms</strong> – identifying expired or above-market agreements</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span><strong>Resiliency & redundancy</strong> – flagging single points of failure</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span><strong>Technology shifts</strong> – DIA vs. MPLS, broadband vs. fiber, cloud backbone options</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span><strong>Utilization & right-sizing</strong> – matching bandwidth to actual demand</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span><strong>Cloud egress fees</strong> – uncovering hidden costs in hyperscaler traffic patterns</span>
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Button 
                onClick={() => window.history.back()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                Add Circuits to Begin Analysis
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Network Optimization</h1>
              <p className="text-sm text-gray-600">
                Identify cost savings and performance improvements for your telecom infrastructure
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-8 pb-8">
          {/* Overview Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Current Network Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">${metrics.totalCost.toLocaleString()}</div>
                <p className="text-sm text-gray-600 mt-1">Monthly recurring cost</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Optimization Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{metrics.opportunities}</div>
                <p className="text-sm text-gray-600 mt-1">High-cost circuits identified</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Potential Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">$127,000</div>
                <p className="text-sm text-gray-600 mt-1">Annual cost reduction</p>
              </CardContent>
            </Card>
          </div>

          {/* Megaport Optimization Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recommended Solutions</h2>
            <div onClick={() => setShowMegaportAssessment(true)} className="cursor-pointer">
              <MegaportOptimizationCard 
                totalCircuits={metrics.circuitCount}
                mplsCost={45000}
                internetCost={12000}
                privateCost={8000}
              />
            </div>
          </div>

          {/* Additional Optimization Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Circuit Consolidation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-800 text-sm mb-4">
                  Identify redundant or underutilized circuits that can be consolidated or eliminated.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Potential savings:</span>
                    <span className="font-semibold text-blue-900">$18,000/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Circuits to review:</span>
                    <span className="font-semibold text-blue-900">7 circuits</span>
                  </div>
                </div>
                <Button size="sm" className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                  View Analysis
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-900">Bandwidth Optimization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-green-800 text-sm mb-4">
                  Right-size bandwidth allocations based on actual usage patterns and business needs.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Potential savings:</span>
                    <span className="font-semibold text-green-900">$12,500/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Over-provisioned:</span>
                    <span className="font-semibold text-green-900">4 circuits</span>
                  </div>
                </div>
                <Button size="sm" className="w-full mt-4 bg-green-600 hover:bg-green-700">
                  View Analysis
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-200">
              <CardHeader>
                <CardTitle className="text-purple-900">Contract Renegotiation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-purple-800 text-sm mb-4">
                  Leverage market rates and competitive pricing to renegotiate existing contracts.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-700">Potential savings:</span>
                    <span className="font-semibold text-purple-900">$22,000/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">Contracts expiring:</span>
                    <span className="font-semibold text-purple-900">6 circuits</span>
                  </div>
                </div>
                <Button size="sm" className="w-full mt-4 bg-purple-600 hover:bg-purple-700">
                  View Analysis
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-yellow-900">Technology Upgrade</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-800 text-sm mb-4">
                  Modernize legacy circuits with newer, more cost-effective technologies.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-yellow-700">Potential savings:</span>
                    <span className="font-semibold text-yellow-900">$15,200/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-700">Legacy circuits:</span>
                    <span className="font-semibold text-yellow-900">3 circuits</span>
                  </div>
                </div>
                <Button size="sm" className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700">
                  View Analysis
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showMegaportAssessment && (
        <MegaportAssessmentPage 
          onClose={() => setShowMegaportAssessment(false)}
        />
      )}
    </div>
  );
}