import SimpleNetworkDiagram from "@/components/SimpleNetworkDiagram";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const NetworkVisualizerPage = () => {
  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 bg-gray-100 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Site Topology
            </Button>
          </Link>
          <h1 className="text-xl font-bold">WAN Diagram Tool</h1>
        </div>
        <div className="text-sm text-gray-600">
          Network Device Visualizer
        </div>
      </div>
      <SimpleNetworkDiagram />
    </div>
  );
};

export default NetworkVisualizerPage;