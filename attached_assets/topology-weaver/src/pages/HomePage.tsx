import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TopologyManager from "@/components/TopologyManager";
import NetworkAssessmentComponent from "@/components/NetworkAssessment";
import { TopologyConfig, NetworkElement } from "@/types/topology";
import { motion, AnimatePresence } from "framer-motion";
import { Network, Settings, HelpCircle } from "lucide-react";

interface HomePageProps {
  onEnterTopology: (topology: TopologyConfig) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onEnterTopology }) => {
  const [topologies, setTopologies] = useState<TopologyConfig[]>(() => {
    const saved = localStorage.getItem('network-topologies');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAssessment, setShowAssessment] = useState(false);
  const [currentTopology, setCurrentTopology] = useState<Omit<TopologyConfig, 'networkElements'> | null>(null);

  const saveTopologies = (newTopologies: TopologyConfig[]) => {
    setTopologies(newTopologies);
    localStorage.setItem('network-topologies', JSON.stringify(newTopologies));
  };

  const handleCreateTopology = (topology: Omit<TopologyConfig, 'id' | 'createdAt' | 'lastModified'>) => {
    setCurrentTopology({
      id: Date.now().toString(),
      name: topology.name,
      description: topology.description,
      createdAt: new Date(),
      lastModified: new Date(),
    });
    setShowAssessment(true);
  };

  const handleAssessmentComplete = (networkElements: NetworkElement[]) => {
    if (currentTopology) {
      const newTopology: TopologyConfig = {
        ...currentTopology,
        networkElements,
      };

      const updatedTopologies = [...topologies, newTopology];
      saveTopologies(updatedTopologies);
      onEnterTopology(newTopology);
    }
  };

  const handleAssessmentSkip = () => {
    if (currentTopology) {
      const newTopology: TopologyConfig = {
        ...currentTopology,
        networkElements: [
          { id: 'internet', type: 'internet', name: 'Internet', enabled: true },
          { id: 'mpls', type: 'mpls', name: 'MPLS', enabled: true }
        ],
      };

      const updatedTopologies = [...topologies, newTopology];
      saveTopologies(updatedTopologies);
      onEnterTopology(newTopology);
    }
  };

  const handleLoadTopology = (topology: TopologyConfig) => {
    onEnterTopology(topology);
  };

  const handleDeleteTopology = (id: string) => {
    const updatedTopologies = topologies.filter(t => t.id !== id);
    saveTopologies(updatedTopologies);
  };

  if (showAssessment) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-2">
              Network Assessment
            </h1>
            <p className="text-gray-600">
              Help us understand your network infrastructure to create an accurate topology
            </p>
          </motion.div>

          <NetworkAssessmentComponent
            onComplete={handleAssessmentComplete}
            onSkip={handleAssessmentSkip}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 py-6 px-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-7xl mx-auto"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Network className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-light tracking-tight text-gray-900">
                Topology<span className="font-semibold">Weaver</span>
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              Network Topology Designer
            </div>
          </div>
        </motion.div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Welcome to TopologyWeaver
            </h2>
            <p className="text-gray-600">
              Design, visualize, and manage your network topologies with ease. 
              Create new topologies or load existing ones to get started.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Visual Design</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Create interactive network diagrams with drag-and-drop functionality 
                    and real-time updates.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-lg">Smart Assessment</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Answer a few questions about your network and we'll automatically 
                    generate the appropriate cloud elements.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-purple-600" />
                    <CardTitle className="text-lg">Easy Management</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Save, load, and manage multiple topology configurations with 
                    persistent storage.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <TopologyManager
            topologies={topologies}
            onCreateTopology={handleCreateTopology}
            onLoadTopology={handleLoadTopology}
            onDeleteTopology={handleDeleteTopology}
          />
        </motion.div>
      </main>
    </div>
  );
};

export default HomePage;