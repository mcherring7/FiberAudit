import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Save } from "lucide-react";

export default function BenchmarkSettings() {
  const handleSave = () => {
    console.log("Save benchmark settings");
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar
        title="Benchmark Settings"
        subtitle="Configure industry benchmarks and thresholds"
      />
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Cost Thresholds */}
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Cost Thresholds</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    High Cost Threshold ($/Mbps)
                  </label>
                  <Input 
                    type="number"
                    step="0.01"
                    defaultValue="10.00"
                    placeholder="Enter threshold..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Circuits above this cost per Mbps will be flagged as high cost
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Excellent Value Threshold ($/Mbps)
                  </label>
                  <Input 
                    type="number"
                    step="0.01"
                    defaultValue="5.00"
                    placeholder="Enter threshold..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Circuits below this cost per Mbps will be marked as excellent value
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Industry Benchmarks */}
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle>Industry Benchmarks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {[
                  { service: "MPLS", benchmark: "8.50" },
                  { service: "Ethernet", benchmark: "6.75" },
                  { service: "SD-WAN", benchmark: "4.25" },
                  { service: "Fiber", benchmark: "3.50" },
                  { service: "Dark Fiber", benchmark: "1.25" },
                ].map((item) => (
                  <div key={item.service} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{item.service}</span>
                    <div className="flex items-center space-x-2">
                      <Input 
                        type="number"
                        step="0.01"
                        defaultValue={item.benchmark}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">$/Mbps</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contract Alerts */}
          <Card className="border-neutral-200">
            <CardHeader>
              <CardTitle>Contract Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Contract Expiration Alert (days)
                </label>
                <Input 
                  type="number"
                  defaultValue="90"
                  placeholder="Enter days..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alert when contracts expire within this many days
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
