import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Flag, 
  FileText, 
  Wand2, 
  Download, 
  ChevronRight 
} from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      icon: Flag,
      title: "Flag High Cost Circuits",
      iconColor: "text-accent",
    },
    {
      icon: FileText,
      title: "Generate PDF Report",
      iconColor: "text-primary",
    },
    {
      icon: Wand2,
      title: "Bulk Optimization",
      iconColor: "text-success",
    },
    {
      icon: Download,
      title: "Export to Excel",
      iconColor: "text-muted-foreground",
    },
  ];

  const recentActivity = [
    {
      user: "John D.",
      action: "flagged 3 circuits as high cost",
      time: "2 hours ago",
    },
    {
      user: "Sarah M.",
      action: "updated contract terms for CIR-VZN-005678",
      time: "4 hours ago",
    },
  ];

  return (
    <Card className="border-neutral-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {actions.map((action) => (
            <Button
              key={action.title}
              variant="outline"
              className="w-full justify-between text-left h-auto p-4"
            >
              <div className="flex items-center space-x-3">
                <action.icon className={`w-5 h-5 ${action.iconColor}`} />
                <span className="font-medium text-foreground">{action.title}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Button>
          ))}

          <div className="pt-4 border-t border-neutral-200">
            <div className="text-sm text-muted-foreground mb-2">Recent Activity</div>
            <div className="space-y-2">
              {recentActivity.map((activity, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  <span className="font-medium">{activity.user}</span> {activity.action}
                  <span className="text-muted-foreground block">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
