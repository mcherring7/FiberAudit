import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TopologyConfig } from "@/types/topology";
import { Plus, FileText, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface TopologyManagerProps {
  topologies: TopologyConfig[];
  onCreateTopology: (topology: Omit<TopologyConfig, 'id' | 'createdAt' | 'lastModified'>) => void;
  onLoadTopology: (topology: TopologyConfig) => void;
  onDeleteTopology: (id: string) => void;
}

const TopologyManager: React.FC<TopologyManagerProps> = ({
  topologies,
  onCreateTopology,
  onLoadTopology,
  onDeleteTopology,
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTopologyName, setNewTopologyName] = useState("");
  const [newTopologyDescription, setNewTopologyDescription] = useState("");

  const handleCreateTopology = () => {
    if (newTopologyName.trim()) {
      onCreateTopology({
        name: newTopologyName.trim(),
        description: newTopologyDescription.trim(),
        networkElements: [
          { id: 'internet', type: 'internet', name: 'Internet', enabled: true },
          { id: 'mpls', type: 'mpls', name: 'MPLS', enabled: true }
        ]
      });
      setNewTopologyName("");
      setNewTopologyDescription("");
      setIsCreateDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Network Topologies</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create New Topology
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Topology</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Topology Name</Label>
                <Input
                  id="name"
                  value={newTopologyName}
                  onChange={(e) => setNewTopologyName(e.target.value)}
                  placeholder="Enter topology name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newTopologyDescription}
                  onChange={(e) => setNewTopologyDescription(e.target.value)}
                  placeholder="Describe this network topology"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTopology}>
                  Create Topology
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {topologies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No topologies yet</h3>
            <p className="text-gray-500 mb-4">Create your first network topology to get started</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              Create Your First Topology
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topologies.map((topology, index) => (
            <motion.div
              key={topology.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">{topology.name}</CardTitle>
                  {topology.description && (
                    <p className="text-sm text-gray-600">{topology.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <Calendar className="h-4 w-4 mr-1" />
                    Last modified: {new Date(topology.lastModified).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => onLoadTopology(topology)}
                      className="flex-1"
                    >
                      Open
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onDeleteTopology(topology.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopologyManager;