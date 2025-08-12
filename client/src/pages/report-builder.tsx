import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, Eye } from "lucide-react";

export default function ReportBuilder() {
  const handlePreview = () => {
    console.log("Preview report");
  };

  const handleGenerate = () => {
    console.log("Generate PDF report");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar
        title="Report Builder"
        subtitle="Create professional client deliverables"
      />

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Report Configuration */}
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Report Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Report Title
                  </label>
                  <Input 
                    placeholder="Enter report title..."
                    defaultValue="Network Optimization Report - Acme Corp"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Client Name
                  </label>
                  <Input 
                    placeholder="Enter client name..."
                    defaultValue="Acme Corporation"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Executive Summary
                </label>
                <Textarea 
                  placeholder="Enter executive summary..."
                  rows={4}
                  defaultValue="This report provides a comprehensive analysis of Acme Corporation's telecommunications infrastructure, identifying $127,000 in potential annual savings through network optimization and carrier consolidation."
                />
              </div>
            </CardContent>
          </Card>

          {/* Report Sections */}
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle>Report Sections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "Executive Summary", included: true },
                  { name: "Current State Analysis", included: true },
                  { name: "Cost Analysis", included: true },
                  { name: "Optimization Opportunities", included: true },
                  { name: "Recommendations", included: true },
                  { name: "Implementation Timeline", included: false },
                  { name: "Risk Assessment", included: false },
                ].map((section) => (
                  <div key={section.name} className="flex items-center space-x-3">
                    <input 
                      type="checkbox" 
                      defaultChecked={section.included}
                      className="rounded border-neutral-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-foreground">{section.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle>Branding & Design</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Primary Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-primary rounded border"></div>
                    <Input value="#1565C0" className="w-24" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Company Logo
                  </label>
                  <Button variant="outline">
                    Upload Logo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleGenerate}>
              <Download className="w-4 h-4 mr-2" />
              Generate PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}