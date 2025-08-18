import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Filter, 
  Edit, 
  MoreVertical,
  ArrowUpDown,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Clock,
  Plus
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import CircuitEditDialog from "./circuit-edit-dialog";
import AddCircuitDialog from "./add-circuit-dialog";
import { Circuit } from "@shared/schema";

export default function CircuitTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCircuits, setSelectedCircuits] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingCircuit, setEditingCircuit] = useState<Circuit | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSiteForAdd, setSelectedSiteForAdd] = useState<string>("");
  const [templateCircuit, setTemplateCircuit] = useState<Circuit | null>(null);
  
  const queryClient = useQueryClient();

  const { data: circuits = [], isLoading } = useQuery<Circuit[]>({
    queryKey: ["/api/circuits"],
    queryFn: async () => {
      // Get current project ID from URL or localStorage
      const projectId = new URLSearchParams(window.location.search).get('projectId') || 
                       localStorage.getItem('currentProjectId') || 
                       'project-1'; // fallback
      
      const response = await fetch(`/api/circuits?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch circuits');
      }
      return response.json();
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[], updates: any }) => {
      const response = await fetch("/api/circuits/bulk", {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids, updates }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to bulk update circuits: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/circuits"] });
      setSelectedCircuits([]);
    },
  });

  const updateCircuitMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<Circuit> }) => {
      const response = await fetch(`/api/circuits/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update circuit: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/circuits"] });
      setEditingCircuit(null);
    },
    onError: (error) => {
      console.error('Circuit update error:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
    },
  });

  const deleteCircuitMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/circuits/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete circuit: ${response.statusText}`);
      }
      
      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/circuits"] });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCircuits(circuits.map((circuit: Circuit) => circuit.id));
    } else {
      setSelectedCircuits([]);
    }
  };

  const handleSelectCircuit = (circuitId: string, checked: boolean) => {
    if (checked) {
      setSelectedCircuits(prev => [...prev, circuitId]);
    } else {
      setSelectedCircuits(prev => prev.filter(id => id !== circuitId));
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleBulkUpdate = () => {
    if (selectedCircuits.length > 0) {
      // This would open a modal for bulk editing
      console.log("Bulk update:", selectedCircuits);
    }
  };

  const handleEditCircuit = (circuit: Circuit) => {
    setEditingCircuit(circuit);
  };

  const handleSaveCircuit = (circuitId: string, updates: Partial<Circuit>) => {
    updateCircuitMutation.mutate({ id: circuitId, updates });
  };

  const handleDeleteCircuit = (circuitId: string) => {
    deleteCircuitMutation.mutate(circuitId);
    setEditingCircuit(null);
  };

  const handleAddCircuitToSite = (circuit: Circuit) => {
    setSelectedSiteForAdd(circuit.siteName);
    setTemplateCircuit(circuit);
    setShowAddDialog(true);
  };

  const handleAddNewCircuit = () => {
    setSelectedSiteForAdd("");
    setTemplateCircuit(null);
    setShowAddDialog(true);
  };

  const getStatusBadge = (optimizationStatus: string, costPerMbps: string) => {
    const cost = parseFloat(costPerMbps);
    
    if (cost > 10) {
      return (
        <Badge variant="destructive" className="bg-accent/10 text-accent border-accent/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          High Cost
        </Badge>
      );
    }
    
    if (optimizationStatus === "opportunity") {
      return (
        <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
          <Lightbulb className="w-3 h-3 mr-1" />
          Opportunity
        </Badge>
      );
    }
    
    if (optimizationStatus === "optimized") {
      return (
        <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Optimized
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-neutral-100 text-muted-foreground">
        <Clock className="w-3 h-3 mr-1" />
        Under Review
      </Badge>
    );
  };

  const formatCurrency = (amount: string) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(amount));

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading circuits...</div>;
  }

  return (
    <Card className="border-neutral-200">
      <CardHeader className="border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Circuit Inventory
          </CardTitle>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search circuits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-80"
              />
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button 
              onClick={handleBulkUpdate}
              disabled={selectedCircuits.length === 0}
            >
              <Edit className="w-4 h-4 mr-2" />
              Bulk Edit ({selectedCircuits.length})
            </Button>
            <Button 
              onClick={handleAddNewCircuit}
              variant="default"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Circuit
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedCircuits.length === circuits.length && circuits.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("siteName")}
                >
                  Site Name <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("carrier")}
                >
                  Carrier <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("locationType")}
                >
                  Location Type <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("serviceType")}
                >
                  Service Type <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("circuitCategory")}
                >
                  Category <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("bandwidth")}
                >
                  Bandwidth <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("monthlyCost")}
                >
                  Monthly Cost <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("costPerMbps")}
                >
                  Cost/Mbps <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("circuitId")}
                >
                  Circuit ID <ArrowUpDown className="w-4 h-4 ml-1 inline" />
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {circuits.map((circuit: Circuit) => (
                <TableRow key={circuit.id} className="hover:bg-neutral-50">
                  <TableCell>
                    <Checkbox
                      checked={selectedCircuits.includes(circuit.id)}
                      onCheckedChange={(checked) => 
                        handleSelectCircuit(circuit.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">{circuit.siteName}</TableCell>
                  <TableCell>{circuit.carrier}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {circuit.locationType || 'Branch'}
                    </Badge>
                  </TableCell>
                  <TableCell>{circuit.serviceType}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{circuit.circuitCategory || 'Internet'}</span>
                      {circuit.circuitCategory === 'Point-to-Point' && circuit.aLocation && circuit.zLocation && (
                        <span className="text-xs text-muted-foreground">
                          {circuit.aLocation} → {circuit.zLocation}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{circuit.bandwidth}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(circuit.monthlyCost)}
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${
                      parseFloat(circuit.costPerMbps) > 10 ? 'text-accent' : 
                      parseFloat(circuit.costPerMbps) < 5 ? 'text-success' : 'text-foreground'
                    }`}>
                      ${parseFloat(circuit.costPerMbps).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(circuit.optimizationStatus, circuit.costPerMbps)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{circuit.circuitId}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleAddCircuitToSite(circuit)}
                        title="Add another circuit to this site"
                        data-testid={`button-add-to-site-${circuit.id}`}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditCircuit(circuit)}
                        data-testid={`button-edit-circuit-${circuit.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination would go here */}
        <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-medium">1</span> to{" "}
            <span className="font-medium">{circuits.length}</span> of{" "}
            <span className="font-medium">{circuits.length}</span> circuits
          </div>
        </div>
      </CardContent>

      {/* Circuit Edit Dialog */}
      {editingCircuit && (
        <CircuitEditDialog
          circuit={editingCircuit}
          open={!!editingCircuit}
          onClose={() => setEditingCircuit(null)}
          onSave={handleSaveCircuit}
          onDelete={handleDeleteCircuit}
        />
      )}

      {/* Add Circuit Dialog */}
      <AddCircuitDialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setTemplateCircuit(null);
        }}
        initialSiteName={selectedSiteForAdd}
        templateCircuit={templateCircuit}
      />
    </Card>
  );
}
