import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, AlertTriangle, Lightbulb, BarChart } from "lucide-react";

interface MetricsCardsProps {
  metrics: {
    totalCost: number;
    circuitCount: number;
    highCostCircuits: number;
    opportunities: number;
    avgCostPerMbps: number;
  };
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const cards = [
    {
      title: "Total Monthly Cost",
      value: formatCurrency(metrics.totalCost),
      subtitle: "Across all circuits",
      icon: DollarSign,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "High Cost Circuits",
      value: metrics.highCostCircuits.toString(),
      subtitle: "Require attention",
      icon: AlertTriangle,
      bgColor: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      title: "Optimization Opportunities",
      value: metrics.opportunities.toString(),
      subtitle: "Ready for implementation",
      icon: Lightbulb,
      bgColor: "bg-success/10",
      iconColor: "text-success",
    },
    {
      title: "Avg Cost per Mbps",
      value: formatCurrency(metrics.avgCostPerMbps),
      subtitle: "15% above benchmark",
      icon: BarChart,
      bgColor: "bg-warning/10",
      iconColor: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <Card key={card.title} className="border-neutral-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.subtitle}</p>
              </div>
              <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
