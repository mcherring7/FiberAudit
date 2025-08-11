import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Network, TrendingDown, Shield, Zap, Globe, ArrowRight } from "lucide-react";

interface MegaportOptimizationCardProps {
  totalCircuits: number;
  mplsCost: number;
  internetCost: number;
  privateCost: number;
}

export default function MegaportOptimizationCard({ 
  totalCircuits, 
  mplsCost, 
  internetCost, 
  privateCost 
}: MegaportOptimizationCardProps) {
  // Calculate potential savings with Megaport NaaS
  const totalCurrentCost = mplsCost + internetCost + privateCost;
  const estimatedMegaportSavings = Math.round(mplsCost * 0.35); // 35% MPLS cost reduction
  const estimatedNewMonthlyCost = totalCurrentCost - estimatedMegaportSavings;
  const annualSavings = estimatedMegaportSavings * 12;

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Network className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-orange-900">Megaport NaaS Optimization</CardTitle>
              <p className="text-sm text-orange-700">Hybrid WAN Transformation Opportunity</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-orange-200 text-orange-800 font-semibold">
            Recommended
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current State Analysis */}
        <div className="bg-white/60 rounded-lg p-3 space-y-2">
          <h4 className="font-medium text-orange-900 text-sm">Current Network Analysis</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-600">MPLS Circuits:</span>
              <p className="font-semibold text-gray-900">${mplsCost.toLocaleString()}/month</p>
            </div>
            <div>
              <span className="text-gray-600">Total Spend:</span>
              <p className="font-semibold text-gray-900">${totalCurrentCost.toLocaleString()}/month</p>
            </div>
          </div>
        </div>

        {/* Megaport Benefits */}
        <div className="space-y-3">
          <h4 className="font-medium text-orange-900 text-sm">Megaport Hybrid WAN Benefits</h4>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-3 w-3 text-green-600" />
              <span className="text-gray-700">35% MPLS Cost Reduction</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="h-3 w-3 text-blue-600" />
              <span className="text-gray-700">On-Demand Provisioning</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-3 w-3 text-purple-600" />
              <span className="text-gray-700">Private Backbone</span>
            </div>
            <div className="flex items-center space-x-2">
              <Globe className="h-3 w-3 text-orange-600" />
              <span className="text-gray-700">975+ Global PoPs</span>
            </div>
          </div>

          {/* Savings Projection */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-green-900 text-sm">Projected Savings</h5>
              <Badge className="bg-green-500 text-white text-xs">
                ${estimatedMegaportSavings.toLocaleString()}/month
              </Badge>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-green-700">Annual Savings:</span>
                <span className="font-semibold text-green-900">${annualSavings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">New Monthly Cost:</span>
                <span className="font-semibold text-green-900">${estimatedNewMonthlyCost.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Architecture Benefits */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h5 className="font-medium text-blue-900 text-sm mb-2">Hybrid WAN Architecture</h5>
          <p className="text-xs text-blue-800 leading-relaxed">
            Replace expensive MPLS with diverse DIA connections to Megaport regional hubs. 
            Maintain enterprise-grade performance while reducing costs and improving agility.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <Button 
            size="sm" 
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs"
            data-testid="button-megaport-assessment"
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Start Assessment
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="border-orange-300 text-orange-700 hover:bg-orange-50 text-xs"
            data-testid="button-megaport-learn-more"
            onClick={() => window.open('https://www.megaport.com/solutions/hybrid-cloud/', '_blank')}
          >
            Learn More
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}