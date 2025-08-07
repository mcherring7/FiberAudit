import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import HomePage from "@/pages/HomePage";
import Index from "@/pages/Index";
import NetworkVisualizerPage from "@/pages/NetworkVisualizerPage";
import NotFound from "@/pages/NotFound";
import { TopologyConfig } from "@/types/topology";
import { ProviderProvider } from "@/contexts/ProviderContext";
import "./App.css";

function App() {
  const [currentTopology, setCurrentTopology] = useState<TopologyConfig | null>(null);

  const handleEnterTopology = (topology: TopologyConfig) => {
    setCurrentTopology(topology);
  };

  const handleExitTopology = () => {
    setCurrentTopology(null);
  };

  return (
    <ProviderProvider>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={
              currentTopology ? (
                <Index 
                  sites={currentTopology?.sites || []}
                  setSites={(sites) => {
                    setCurrentTopology(prev => prev ? {...prev, sites} : null);
                  }}
                  onBackToHome={handleExitTopology} 
                  networkElements={currentTopology?.networkElements || []}
                />
              ) : (
                <HomePage onEnterTopology={handleEnterTopology} />
              )
            } 
          />
          <Route path="/network-visualizer" element={<NetworkVisualizerPage />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Router>
    </ProviderProvider>
  );
}

export default App;