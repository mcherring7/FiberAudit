import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Flag } from "lucide-react";
import { AuditFlag } from "@shared/schema";

export default function AuditFlags() {
  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["/api/audit-flags"],
    queryFn: async () => {
      const response = await fetch("/api/audit-flags");
      if (!response.ok) throw new Error("Failed to fetch audit flags");
      return response.json();
    },
  });

  const getSeverityBadge = (severity: string) => {
    const variants = {
      high: "bg-destructive/10 text-destructive border-destructive/20",
      medium: "bg-warning/10 text-warning border-warning/20",
      low: "bg-muted text-muted-foreground",
    };
    
    return (
      <Badge variant="outline" className={variants[severity as keyof typeof variants] || variants.medium}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </Badge>
    );
  };

  const getTypeIcon = (flagType: string) => {
    switch (flagType) {
      case "high-cost": return AlertTriangle;
      case "opportunity": return Flag;
      case "contract": return Clock;
      default: return AlertTriangle;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading audit flags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar
        title="Audit Flags"
        subtitle={`${flags.length} total flags • ${flags.filter(f => !f.isResolved).length} unresolved`}
      />
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-4">
          {flags.length === 0 ? (
            <Card className="border-neutral-200">
              <CardContent className="p-12 text-center">
                <Flag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Audit Flags</h3>
                <p className="text-muted-foreground">
                  No audit flags have been created yet. Flags will appear here when circuits require attention.
                </p>
              </CardContent>
            </Card>
          ) : (
            flags.map((flag) => {
              const IconComponent = getTypeIcon(flag.flagType);
              return (
                <Card key={flag.id} className="border-neutral-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <IconComponent className="w-5 h-5 text-accent" />
                        <div>
                          <CardTitle className="text-base">{flag.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">{flag.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getSeverityBadge(flag.severity)}
                        {flag.isResolved ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolved
                          </Badge>
                        ) : (
                          <Button variant="outline" size="sm">
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Flag Type: {flag.flagType}</span>
                      <span>Created: {flag.createdAt ? new Date(flag.createdAt).toLocaleDateString() : 'Unknown'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
