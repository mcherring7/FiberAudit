import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";

export default function BenchmarkAnalysis() {
  const alerts = [
    {
      type: "high-cost",
      icon: AlertTriangle,
      title: "High Cost Alert",
      description: "CIR-ATT-001234 is 47% above market benchmark",
      current: "$12.45/Mbps",
      benchmark: "$8.50/Mbps",
      bgColor: "bg-accent/5",
      borderColor: "border-accent/20",
      iconColor: "text-accent",
    },
    {
      type: "opportunity",
      icon: Lightbulb,
      title: "Optimization Opportunity",
      description: "Consider SD-WAN migration for MPLS circuits",
      current: "Potential Savings:",
      benchmark: "$2,840/month",
      bgColor: "bg-success/5",
      borderColor: "border-success/20",
      iconColor: "text-success",
    },
    {
      type: "renewal",
      icon: TrendingUp,
      title: "Contract Renewal Alert",
      description: "15 circuits expiring in next 90 days",
      current: "Renewal Value:",
      benchmark: "$45K/month",
      bgColor: "bg-warning/5",
      borderColor: "border-warning/20",
      iconColor: "text-warning",
    },
  ];

  return (
    <Card className="col-span-2 border-neutral-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Benchmark Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
