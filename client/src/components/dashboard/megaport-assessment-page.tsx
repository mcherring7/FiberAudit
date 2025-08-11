import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Network, 
  TrendingDown, 
  Shield, 
  Zap, 
  Globe, 
  ArrowRight, 
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  Building2
} from "lucide-react";

interface MegaportAssessmentPageProps {
  onClose: () => void;
}

export default function MegaportAssessmentPage({ onClose }: MegaportAssessmentPageProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Sample data for assessment
  const assessmentData = {
    currentArchitecture: {
      mplsSites: 15,
      internetSites: 8,
      totalMonthlyCost: 65000,
      mplsCostPerMbps: 45,
      avgLatency: 65,
      redundancy: "Limited"
    },
    megaportProposal: {
      hybridArchitecture: "DIA + Megaport Backbone",
      newMonthlyCost: 42000,
      costReduction: 23000,
      newCostPerMbps: 28,
      avgLatency: 35,
      redundancy: "Full",
      implementationTime: "4-6 weeks"
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Current Network Assessment</h3>
              <p className="text-gray-600">Analysis of your existing WAN architecture and costs</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-700">Circuit Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">MPLS Sites</span>
                      <Badge variant="secondary">{assessmentData.currentArchitecture.mplsSites}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Internet Sites</span>
                      <Badge variant="secondary">{assessmentData.currentArchitecture.internetSites}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Monthly Cost</span>
                      <Badge className="bg-red-100 text-red-800">
                        ${assessmentData.currentArchitecture.totalMonthlyCost.toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-700">Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Cost per Mbps</span>
                      <Badge variant="outline">${assessmentData.currentArchitecture.mplsCostPerMbps}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Avg Latency</span>
                      <Badge variant="outline">{assessmentData.currentArchitecture.avgLatency}ms</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Redundancy</span>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        {assessmentData.currentArchitecture.redundancy}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-orange-900">Network Challenges Identified</h4>
                    <ul className="mt-2 text-sm text-orange-800 space-y-1">
                      <li>• High MPLS costs limiting network expansion</li>
                      <li>• Limited redundancy creating single points of failure</li>
                      <li>• Slow provisioning times for new site connections</li>
                      <li>• Inconsistent performance across dispersed locations</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Megaport Hybrid WAN Solution</h3>
              <p className="text-gray-600">Recommended architecture transformation using Megaport NaaS</p>
            </div>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-orange-900">
                  <Network className="h-5 w-5" />
                  <span>Proposed Architecture</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-white/60 rounded-lg p-4">
                    <h4 className="font-medium text-orange-900 mb-3">Hybrid WAN Transformation</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 block">Current:</span>
                        <span className="font-medium text-gray-900">Traditional MPLS + Internet</span>
                      </div>
                      <div>
                        <span className="text-gray-600 block">Proposed:</span>
                        <span className="font-medium text-orange-900">DIA + Megaport Backbone</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="bg-white/60 rounded-lg p-3">
                      <Globe className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                      <span className="text-xs font-medium text-gray-900">975+ PoPs</span>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3">
                      <Zap className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <span className="text-xs font-medium text-gray-900">On-Demand</span>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3">
                      <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <span className="text-xs font-medium text-gray-900">Private Backbone</span>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3">
                      <TrendingDown className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <span className="text-xs font-medium text-gray-900">35% Savings</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-700">Technical Benefits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Software-defined networking</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Direct cloud connectivity</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Enhanced security & compliance</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>API-driven automation</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-700">Business Benefits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Reduced operational costs</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Faster site provisioning</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Improved network agility</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Scalable architecture</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Financial Impact Analysis</h3>
              <p className="text-gray-600">Detailed cost comparison and ROI projections</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-700 flex items-center space-x-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Current State</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-900">
                        ${assessmentData.currentArchitecture.totalMonthlyCost.toLocaleString()}
                      </div>
                      <div className="text-sm text-red-700">Monthly Cost</div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cost per Mbps:</span>
                        <span className="font-medium">${assessmentData.currentArchitecture.mplsCostPerMbps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Annual Cost:</span>
                        <span className="font-medium">${(assessmentData.currentArchitecture.totalMonthlyCost * 12).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-gray-700 flex items-center space-x-2">
                    <TrendingDown className="h-4 w-4" />
                    <span>With Megaport</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        ${assessmentData.megaportProposal.newMonthlyCost.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-700">Monthly Cost</div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cost per Mbps:</span>
                        <span className="font-medium">${assessmentData.megaportProposal.newCostPerMbps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Annual Cost:</span>
                        <span className="font-medium">${(assessmentData.megaportProposal.newMonthlyCost * 12).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-green-900">
                      ${assessmentData.megaportProposal.costReduction.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-700">Monthly Savings</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xl font-semibold text-green-900">
                        ${(assessmentData.megaportProposal.costReduction * 12).toLocaleString()}
                      </div>
                      <div className="text-xs text-green-700">Annual Savings</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-green-900">35%</div>
                      <div className="text-xs text-green-700">Cost Reduction</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-green-900">18 mo</div>
                      <div className="text-xs text-green-700">ROI Payback</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Implementation Roadmap</h3>
              <p className="text-gray-600">Migration timeline and next steps</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Migration Timeline: {assessmentData.megaportProposal.implementationTime}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">1</div>
                      <div>
                        <div className="font-medium">Network Assessment & Design</div>
                        <div className="text-sm text-gray-600">Week 1-2: Detailed site survey and architecture planning</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">2</div>
                      <div>
                        <div className="font-medium">Megaport Infrastructure Setup</div>
                        <div className="text-sm text-gray-600">Week 2-3: Deploy Megaport connections and test connectivity</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">3</div>
                      <div>
                        <div className="font-medium">Pilot Site Migration</div>
                        <div className="text-sm text-gray-600">Week 3-4: Migrate 2-3 pilot sites and validate performance</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">4</div>
                      <div>
                        <div className="font-medium">Full Network Migration</div>
                        <div className="text-sm text-gray-600">Week 4-6: Complete migration and MPLS decommissioning</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Next Steps</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Schedule technical deep-dive with Megaport solutions architect</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Provide detailed site requirements and current contracts</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Receive formal proposal with detailed pricing</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Begin procurement and migration planning</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Megaport Network Transformation Assessment</h2>
              <p className="text-orange-100 mt-1">Comprehensive analysis of your hybrid WAN optimization opportunity</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              ✕
            </Button>
          </div>
          
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-orange-100 mb-2">
              <span>Assessment Progress</span>
              <span>{currentStep} of {totalSteps}</span>
            </div>
            <Progress value={(currentStep / totalSteps) * 100} className="bg-orange-400" />
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {renderStep()}
        </div>

        <div className="border-t bg-gray-50 p-4 flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          
          <div className="flex space-x-2">
            {currentStep < totalSteps ? (
              <Button 
                onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <div className="space-x-2">
                <Button variant="outline">
                  Download Report
                </Button>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  Schedule Consultation
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}