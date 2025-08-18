
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Network, Settings } from "lucide-react";
import TopologyViewer from "@/components/network/topology-viewer";
import SiteList from "@/components/network/site-list";
import AddConnectionDialog from "@/components/network/add-connection-dialog";
import { Circuit } from "@shared/schema";
import { useLocation } from "wouter";

interface Site {
  id: string;
  name: string;
  location: string;
  category: "Branch" | "Corporate" | "Data Center" | "Cloud";
  connections: Connection[];
  coordinates: { x: number; y: number };
}

interface WANCloud {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

interface Connection {
  type: string;
  bandwidth: string;
  provider?: string;
  pointToPointEndpoint?: string;
  customProvider?: string;
}

const NetworkTopologyPage = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showSiteList, setShowSiteList] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAddConnectionDialog, setShowAddConnectionDialog] = useState(false);
  const [connectionType, setConnectionType] = useState<string>("");
  const [customClouds, setCustomClouds] = useState<WANCloud[]>([]);

  // Get current project ID from URL
  const [location] = useLocation();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Extract project ID from URL - only run once or when location changes
  useEffect(() => {
    const pathParts = location.split('/');
    const projectIndex = pathParts.indexOf('projects');
    
    if (projectIndex !== -1 && projectIndex < pathParts.length - 1) {
      const projectId = pathParts[projectIndex + 1];
      setCurrentProjectId(projectId);
    } else {
      setCurrentProjectId(null);
    }
  }, [location]);

  const [savedDesigns, setSavedDesigns] = useState<any[]>([]);

  // Fetch circuits from the current project's inventory
  const { data: circuits = [], isLoading: circuitsLoading } = useQuery<Circuit[]>({
    queryKey: ['/api/projects', currentProjectId, 'circuits'],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const response = await fetch(`/api/projects/${currentProjectId}/circuits`);
      if (!response.ok) throw new Error('Failed to fetch circuits');
      return response.json();
    },
    enabled: !!currentProjectId
  });

  // Fetch sites for geographic data from current project
  const { data: sitesData = [], isLoading: sitesLoading } = useQuery<any[]>({
    queryKey: ['/api/projects', currentProjectId, 'sites'],
    queryFn: async () => {
      if (!currentProjectId) return [];
      const response = await fetch(`/api/projects/${currentProjectId}/sites`);
      if (!response.ok) throw new Error('Failed to fetch sites');
      return response.json();
    },
    enabled: !!currentProjectId
  });

  // Function to convert geographic coordinates to normalized canvas coordinates
  const convertGeoToCanvas = (latitude: number, longitude: number) => {
    // US bounds for better positioning
    const minLat = 24.396308; // Southern tip of Florida
    const maxLat = 49.384358; // Northern border
    const minLng = -125.0;    // West coast
    const maxLng = -66.93457; // East coast

    // Normalize coordinates to 0-1 range with padding
    const normalizedLng = (longitude - minLng) / (maxLng - minLng);
    const normalizedLat = 1 - (latitude - minLat) / (maxLat - minLat); // Flip Y axis

    // Add padding and constrain to viewport
    const padding = 0.1;
    const x = padding + normalizedLng * (1 - 2 * padding);
    const y = padding + normalizedLat * (1 - 2 * padding);

    return {
      x: Math.max(0.05, Math.min(0.95, x)),
      y: Math.max(0.05, Math.min(0.95, y))
    };
  };

  // Convert circuits to sites format for visualization
  useEffect(() => {
    if (!currentProjectId) {
      setSites([]);
      return;
    }

    // If no circuits but we have sites data, use sites data
    if (circuits.length === 0 && sitesData.length > 0) {
      const convertedSites = sitesData.map(site => ({
        ...site,
        connections: [],
        coordinates: site.coordinates || { x: 0.5, y: 0.5 }
      }));
      setSites(convertedSites);
      return;
    }

    if (circuits.length === 0) {
      setSites([]);
      return;
    }

    const siteMap = new Map<string, Site>();

    circuits.forEach((circuit, index) => {
      const siteName = circuit.siteName;
      const siteId = circuit.siteName.toLowerCase().replace(/\s+/g, '-');

      if (!siteMap.has(siteId)) {
        // Find corresponding site data for geographic coordinates
        const siteData = sitesData.find((s: any) => s.name === siteName);

        let coordinates = { x: 0.5, y: 0.5 }; // Default center position

        if (siteData?.latitude && siteData?.longitude) {
          // Use actual geographic coordinates
          coordinates = convertGeoToCanvas(siteData.latitude, siteData.longitude);
        } else {
          // Fallback to spread positioning to avoid overlap
          const hash = siteName.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0);

          coordinates = {
            x: 0.15 + (Math.abs(hash % 100) / 100) * 0.7,
            y: 0.15 + (Math.abs((hash >> 8) % 100) / 100) * 0.7
          };
        }

        siteMap.set(siteId, {
          id: siteId,
          name: siteName,
          location: circuit.locationType || 'Branch',
          category: circuit.locationType as "Branch" | "Corporate" | "Data Center" | "Cloud" || 'Branch',
          connections: [],
          coordinates
        });
      }

      const site = siteMap.get(siteId)!;

      // Add connection based on circuit data
      let connectionType = circuit.circuitCategory || 'Internet';

      // Map service types to connection types
      if (circuit.serviceType === 'MPLS') connectionType = 'mpls';
      else if (circuit.serviceType === 'VPLS') connectionType = 'vpls';
      else if (circuit.serviceType === 'Private Line') connectionType = 'point-to-point';
      else if (circuit.serviceType === 'Dark Fiber') connectionType = 'point-to-point';
      else if (circuit.serviceType === 'Broadband') connectionType = 'internet';
      else if (circuit.serviceType === 'Dedicated Internet') connectionType = 'internet';
      else if (circuit.serviceType === 'LTE') connectionType = 'internet';
      else if (circuit.serviceType === 'Satellite') connectionType = 'internet';
      else if (circuit.serviceType === 'Direct Connect') connectionType = 'aws';

      const connection: Connection = {
        type: connectionType,
        bandwidth: circuit.bandwidth,
        provider: circuit.carrier,
      };

      // Handle Point-to-Point connections
      if (circuit.aLocation && circuit.zLocation) {
        connection.type = 'point-to-point';
        connection.pointToPointEndpoint = circuit.zLocation;
      }

      site.connections.push(connection);
    });

    setSites(Array.from(siteMap.values()));
  }, [circuits, sitesData, currentProjectId]);

  const handleUpdateSiteCoordinates = (siteId: string, coordinates: { x: number; y: number }) => {
    setSites(prev =>
      prev.map(site =>
        site.id === siteId ? { ...site, coordinates } : site
      )
    );
  };

  // Handle site updates
  const handleUpdateSite = (siteId: string, updates: Partial<Site>) => {
    setSites(prev => prev.map(site =>
      site.id === siteId ? { ...site, ...updates } : site
    ));
  };

  // Handle site deletion
  const handleDeleteSite = (siteId: string) => {
    setSites(prev => prev.filter(site => site.id !== siteId));
    if (selectedSite?.id === siteId) {
      setSelectedSite(null);
    }
  };

  // Handle WAN cloud updates
  const handleUpdateWANCloud = (cloudId: string, updates: Partial<WANCloud>) => {
    // This would update WAN cloud positions and properties
    // For now, just trigger a save state change
    setHasUnsavedChanges(true);
  };

  // Handle WAN cloud deletion
  const handleDeleteWANCloud = (cloudId: string) => {
    // This would remove/hide the WAN cloud
    // For now, just trigger a save state change
    setHasUnsavedChanges(true);
  };

  // Handle adding connections from topology view
  const handleAddConnection = (siteId: string, connectionType?: string) => {
    const site = sites.find(s => s.id === siteId);
    if (site) {
      setSelectedSite(site);
      setConnectionType(connectionType || '');
      setShowAddConnectionDialog(true);
    }
  };

  // Save design to localStorage and show confirmation
  const handleSaveDesign = () => {
    try {
      const designData = {
        sites: sites,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      localStorage.setItem('network-topology-design', JSON.stringify(designData));
    } catch (error) {
      console.error('Failed to save design:', error);
    }
  };

  // Load design from localStorage on component mount - run only once after circuits load
  useEffect(() => {
    if (!currentProjectId || circuits.length === 0 || sites.length === 0) return;

    const savedDesign = localStorage.getItem('network-topology-design');
    if (savedDesign) {
      try {
        const designData = JSON.parse(savedDesign);
        if (designData.sites && Array.isArray(designData.sites)) {
          // Only restore positions for existing sites, don't override the circuit-based data
          const savedPositions = new Map(
            designData.sites.map((site: Site) => [site.id, {
              coordinates: site.coordinates,
              name: site.name,
              location: site.location,
              category: site.category
            }])
          );

          setSites(prev => prev.map(site => {
            const saved = savedPositions.get(site.id);
            return saved ? { ...site, ...saved } : site;
          }));
        }
      } catch (error) {
        console.error('Failed to load saved design:', error);
      }
    }
  }, [currentProjectId, circuits.length, sites.length]);

  // Show error if invalid project URL
  if (currentProjectId === null && location.includes('/projects/')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-96">
          <CardHeader className="text-center">
            <Network className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <CardTitle>Invalid Project URL</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              The project URL is not valid. Please select a project from the dashboard.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state
  if (circuitsLoading || sitesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading network topology...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Network Topology</h1>
              <p className="text-sm text-gray-600">
                Interactive visualization of your telecom network infrastructure
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSiteList(!showSiteList)}
            >
              <Network className="h-4 w-4 mr-2" />
              {showSiteList ? 'Hide' : 'Show'} Site List
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Site List Panel */}
        {showSiteList && (
          <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
            <div className="h-full overflow-y-auto p-3">
              <h2 className="text-sm font-medium text-gray-900 mb-3">Network Sites</h2>
              <SiteList
                sites={sites}
                selectedSite={selectedSite}
                onSelectSite={setSelectedSite}
              />
            </div>
          </div>
        )}

        {/* Main Topology View - Full Available Space */}
        <div className="flex-1 relative overflow-hidden">
          {sites.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Card className="w-96">
                <CardHeader className="text-center">
                  <Network className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <CardTitle>No Network Data</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-gray-600 mb-4">
                    Import circuits in the Inventory section to visualize your network topology.
                  </p>
                  <Button onClick={() => window.location.href = '/inventory'}>
                    Go to Inventory
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <TopologyViewer
              sites={sites}
              currentProjectId={currentProjectId}
              selectedSite={selectedSite}
              onSelectSite={setSelectedSite}
              onUpdateSiteCoordinates={handleUpdateSiteCoordinates}
              onUpdateSite={handleUpdateSite}
              onDeleteSite={handleDeleteSite}
              onSaveDesign={handleSaveDesign}
              onUpdateWANCloud={handleUpdateWANCloud}
              onDeleteWANCloud={handleDeleteWANCloud}
              onAddConnection={handleAddConnection}
              onAddWANCloud={(cloud) => {
                const newCloud = {
                  ...cloud,
                  id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };
                setCustomClouds(prev => [...prev, newCloud]);
                setHasUnsavedChanges(true);
              }}
              customClouds={customClouds}
            />
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            {sites.length} sites • {sites.reduce((acc, site) => acc + site.connections.length, 0)} connections
          </div>
          <div>
            {selectedSite ? (
              <span>
                <strong>Selected:</strong> {selectedSite.name} • Click + button to add connection or click WAN cloud to connect
              </span>
            ) : (
              'Click sites to select • Drag sites and WAN clouds to reposition • Double-click to edit'
            )}
          </div>
        </div>
      </div>

      {/* Add Connection Dialog */}
      <AddConnectionDialog
        open={showAddConnectionDialog}
        onClose={() => {
          setShowAddConnectionDialog(false);
          setConnectionType('');
        }}
        selectedSite={selectedSite}
        connectionType={connectionType}
      />
    </div>
  );
};

export default NetworkTopologyPage;
