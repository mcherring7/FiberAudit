
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Network, Loader2 } from "lucide-react";
import TopologyViewer from "@/components/network/topology-viewer";
import SiteList from "@/components/network/site-list";

export default function NetworkTopologyPage() {
  const [location] = useLocation();
  const [isOptimizationView, setIsOptimizationView] = useState(false);
  const [positionsState, setPositionsState] = useState<Record<string, { x: number; y: number }>>({});
  
  // Load design from localStorage - use a ref to track if we've loaded already
  const hasLoadedDesign = useRef(false);

  const currentProjectId = useMemo(() => {
    const pathParts = location.split('/');
    const projectIndex = pathParts.indexOf('projects');
    return projectIndex !== -1 && projectIndex < pathParts.length - 1
      ? pathParts[projectIndex + 1]
      : null;
  }, [location]);

  // Fetch circuits data
  const { data: circuits = [], isLoading: circuitsLoading } = useQuery({
    queryKey: [`/api/projects/${currentProjectId}/circuits`],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const response = await fetch(`/api/projects/${currentProjectId}/circuits`);
      if (!response.ok) throw new Error('Failed to fetch circuits');
      return response.json();
    },
    enabled: !!currentProjectId,
  });

  // Fetch sites data
  const { data: sites = [], isLoading: sitesLoading } = useQuery({
    queryKey: [`/api/projects/${currentProjectId}/sites`],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const response = await fetch(`/api/projects/${currentProjectId}/sites`);
      if (!response.ok) throw new Error('Failed to fetch sites');
      return response.json();
    },
    enabled: !!currentProjectId,
  });

  // Calculate unique sites from circuits data if sites array is empty
  const uniqueSites = useMemo(() => {
    if (sites.length > 0) {
      // Create sites with connections from circuits data
      return sites.map((site: any) => {
        const siteCircuits = circuits.filter((circuit: any) => 
          circuit.siteName && circuit.siteName.toLowerCase() === site.name.toLowerCase()
        );
        
        const connections = siteCircuits.map((circuit: any) => ({
          type: circuit.serviceType || circuit.circuitCategory || 'Unknown',
          bandwidth: circuit.bandwidth || 'Unknown',
          provider: circuit.carrier || undefined,
          pointToPointEndpoint: circuit.zLocation || undefined,
        }));

        return {
          id: site.id,
          name: site.name,
          location: site.location || site.city || 'Unknown',
          category: site.category || 'Branch',
          coordinates: site.coordinates || {
            x: positionsState[site.id]?.x || 0.5,
            y: positionsState[site.id]?.y || 0.5
          },
          connections: connections || [],
        };
      });
    }

    // Fallback: derive sites from circuits
    const siteMap = new Map();
    circuits.forEach((circuit: any) => {
      if (circuit.siteName && !siteMap.has(circuit.siteName)) {
        const siteId = `site-${circuit.siteName.toLowerCase().replace(/\s+/g, '-')}`;
        const siteCircuits = circuits.filter((c: any) => c.siteName === circuit.siteName);
        
        const connections = siteCircuits.map((c: any) => ({
          type: c.serviceType || c.circuitCategory || 'Unknown',
          bandwidth: c.bandwidth || 'Unknown',
          provider: c.carrier || undefined,
          pointToPointEndpoint: c.zLocation || undefined,
        }));

        siteMap.set(circuit.siteName, {
          id: siteId,
          name: circuit.siteName,
          location: circuit.aLocation || 'Unknown',
          category: circuit.locationType || 'Branch',
          coordinates: {
            x: positionsState[siteId]?.x || 0.5,
            y: positionsState[siteId]?.y || 0.5
          },
          connections: connections || [],
        });
      }
    });
    return Array.from(siteMap.values());
  }, [sites, circuits, positionsState]);

  // Load design from localStorage only once when we have data
  useEffect(() => {
    if (!currentProjectId || uniqueSites.length === 0 || hasLoadedDesign.current) return;

    const savedDesign = localStorage.getItem(`network-topology-design-${currentProjectId}`);
    if (savedDesign) {
      try {
        const parsed = JSON.parse(savedDesign);
        if (parsed.positions) {
          setPositionsState(parsed.positions);
          hasLoadedDesign.current = true;
        }
      } catch (error) {
        console.error('Failed to load saved design:', error);
      }
    }
  }, [currentProjectId, uniqueSites.length]);

  // Save design to localStorage
  const saveDesign = useCallback(() => {
    if (!currentProjectId) return;
    
    const designData = {
      positions: positionsState,
      timestamp: new Date().toISOString(),
    };
    
    localStorage.setItem(`network-topology-design-${currentProjectId}`, JSON.stringify(designData));
  }, [currentProjectId, positionsState]);

  const handleSitePositionChange = useCallback((siteId: string, position: { x: number; y: number }) => {
    setPositionsState(prev => ({
      ...prev,
      [siteId]: position
    }));
  }, []);

  // Show error if no project context
  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-96">
          <CardHeader className="text-center">
            <Network className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <CardTitle>No Project Selected</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Please select a project to view network topology.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (circuitsLoading || sitesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading network topology...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Network Topology</h1>
          <p className="text-gray-600">
            Visualize and manage your network infrastructure and connections.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Topology Viewer */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-xl">
                    {isOptimizationView ? 'Optimized' : 'Current'} Network Topology
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {uniqueSites.length} sites • {circuits.length} circuits
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={!isOptimizationView ? "default" : "outline"}
                    onClick={() => setIsOptimizationView(false)}
                    size="sm"
                  >
                    Current
                  </Button>
                  <Button
                    variant={isOptimizationView ? "default" : "outline"}
                    onClick={() => setIsOptimizationView(true)}
                    size="sm"
                  >
                    Optimized
                  </Button>
                  <Button
                    variant="outline"
                    onClick={saveDesign}
                    size="sm"
                  >
                    Save Layout
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TopologyViewer
                  sites={uniqueSites}
                  selectedSite={null}
                  onSelectSite={() => {}}
                  onUpdateSiteCoordinates={handleSitePositionChange}
                  currentProjectId={currentProjectId}
                  isOptimizationView={isOptimizationView}
                />
              </CardContent>
            </Card>
          </div>

          {/* Site List */}
          <div className="lg:col-span-1">
            <SiteList
              sites={uniqueSites}
              selectedSite={null}
              onSelectSite={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
