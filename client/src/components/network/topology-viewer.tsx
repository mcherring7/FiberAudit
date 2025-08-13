
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Building2, Server, Database, Cloud, Edit3, Save, AlertCircle, Settings, Zap, ZoomIn, ZoomOut, CheckCircle, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import SiteEditDialog from './site-edit-dialog';
import WANCloudEditDialog from './wan-cloud-edit-dialog';
import AddWANCloudDialog from './add-wan-cloud-dialog';
import AddMegaportOnrampDialog from './add-megaport-onramp-dialog';

interface Connection {
  type: string;
  bandwidth: string;
  provider?: string;
  pointToPointEndpoint?: string;
  customProvider?: string;
}

interface TopologySite {
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

interface TopologyViewerProps {
  sites: TopologySite[];
  selectedSite?: TopologySite | null;
  onSelectSite?: (site: TopologySite | null) => void;
  onUpdateSiteCoordinates: (siteId: string, coordinates: { x: number; y: number }) => void;
  onUpdateSite?: (siteId: string, updates: Partial<TopologySite>) => void;
  onDeleteSite?: (siteId: string) => void;
  onSaveDesign?: () => void;
  onUpdateWANCloud?: (cloudId: string, updates: Partial<WANCloud>) => void;
  onDeleteWANCloud?: (cloudId: string) => void;
  onAddConnection?: (siteId: string, connectionType?: string) => void;
  onAddWANCloud?: (cloud: Omit<WANCloud, 'id'>) => void;
  customClouds?: WANCloud[];
}

export default function TopologyViewer({ 
  sites, 
  selectedSite, 
  onSelectSite, 
  onUpdateSiteCoordinates,
  onUpdateSite,
  onDeleteSite,
  onSaveDesign,
  onUpdateWANCloud,
  onDeleteWANCloud,
  onAddConnection,
  onAddWANCloud,
  customClouds = []
}: TopologyViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [isDraggingCloud, setIsDraggingCloud] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sitePositions, setSitePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [cloudPositions, setCloudPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [editingSite, setEditingSite] = useState<TopologySite | null>(null);
  const [editingWANCloud, setEditingWANCloud] = useState<WANCloud | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const [hiddenClouds, setHiddenClouds] = useState<Set<string>>(new Set());
  const [connectionVisibility, setConnectionVisibility] = useState({
    siteToCloud: true,
    mplsMesh: true,
    bandwidthLabels: true,
    pointToPoint: true
  });
  const [cloudVisibility, setCloudVisibility] = useState<Record<string, boolean>>({
    internet: true,
    mpls: true,
    'azure-hub': true,
    'aws-hub': true,
    'gcp-hub': true,
    megaport: true
  });
  const [showAddCloudDialog, setShowAddCloudDialog] = useState(false);
  const [isOptimizationView, setIsOptimizationView] = useState(false);
  const [showAddOnrampDialog, setShowAddOnrampDialog] = useState(false);
  const [distanceThreshold, setDistanceThreshold] = useState([300]);

  // Base WAN cloud definitions
  const baseWanClouds: WANCloud[] = [
    { id: 'internet', type: 'Internet', name: 'Internet WAN', x: 0.35, y: 0.5, color: '#3b82f6' },
    { id: 'mpls', type: 'MPLS', name: 'MPLS WAN', x: 0.65, y: 0.5, color: '#8b5cf6' },
    { id: 'azure-hub', type: 'Azure', name: 'Azure ExpressRoute', x: 0.8, y: 0.2, color: '#0078d4' },
    { id: 'aws-hub', type: 'AWS', name: 'AWS Direct Connect', x: 0.2, y: 0.2, color: '#ff9900' },
    { id: 'gcp-hub', type: 'GCP', name: 'Google Cloud', x: 0.5, y: 0.2, color: '#4285f4' },
    { id: 'megaport', type: 'NaaS', name: 'Megaport NaaS', x: 0.5, y: 0.5, color: '#f97316' }
  ];

  // Mock Megaport locations for optimization view
  const megaportLocations = [
    { id: 'mp-seattle', name: 'Seattle', x: 0.15, y: 0.4, region: 'west' },
    { id: 'mp-san-francisco', name: 'San Francisco', x: 0.1, y: 0.5, region: 'west' },
    { id: 'mp-los-angeles', name: 'Los Angeles', x: 0.12, y: 0.65, region: 'west' },
    { id: 'mp-denver', name: 'Denver', x: 0.4, y: 0.5, region: 'central' },
    { id: 'mp-dallas', name: 'Dallas', x: 0.45, y: 0.7, region: 'central' },
    { id: 'mp-chicago', name: 'Chicago', x: 0.6, y: 0.4, region: 'central' },
    { id: 'mp-atlanta', name: 'Atlanta', x: 0.7, y: 0.65, region: 'east' },
    { id: 'mp-new-york', name: 'New York', x: 0.85, y: 0.35, region: 'east' },
    { id: 'mp-miami', name: 'Miami', x: 0.8, y: 0.8, region: 'east' }
  ];

  // Calculate distance between two points
  const calculateDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }) => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get filtered Megaport locations based on distance threshold
  const getFilteredMegaportLocations = useMemo(() => {
    if (!isOptimizationView) return [];
    
    const threshold = distanceThreshold[0] / 1000; // Convert to normalized distance
    const sitesWithPositions = sites.filter(site => sitePositions[site.id]);
    
    if (sitesWithPositions.length === 0) return megaportLocations.slice(0, 3);
    
    const relevantMegaports = new Set<string>();
    
    sitesWithPositions.forEach(site => {
      const sitePos = {
        x: sitePositions[site.id].x / dimensions.width,
        y: sitePositions[site.id].y / dimensions.height
      };
      
      // Find closest Megaport locations within threshold
      megaportLocations.forEach(mp => {
        const distance = calculateDistance(sitePos, mp);
        if (distance <= threshold) {
          relevantMegaports.add(mp.id);
        }
      });
    });
    
    // If no locations within threshold, add closest ones
    if (relevantMegaports.size === 0) {
      const closest = megaportLocations
        .map(mp => {
          const minDistance = Math.min(...sitesWithPositions.map(site => {
            const sitePos = {
              x: sitePositions[site.id].x / dimensions.width,
              y: sitePositions[site.id].y / dimensions.height
            };
            return calculateDistance(sitePos, mp);
          }));
          return { ...mp, distance: minDistance };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, Math.max(2, Math.min(5, Math.ceil(sitesWithPositions.length / 2))));
      
      return closest;
    }
    
    return megaportLocations.filter(mp => relevantMegaports.has(mp.id));
  }, [isOptimizationView, distanceThreshold, sites, sitePositions, dimensions]);

  // Get current WAN clouds based on view mode
  const getCurrentClouds = useMemo(() => {
    if (isOptimizationView) {
      const hyperscalers = [
        { id: 'aws-hub', type: 'AWS', name: 'AWS', x: 0.2, y: 0.15, color: '#ff9900' },
        { id: 'azure-hub', type: 'Azure', name: 'Azure', x: 0.4, y: 0.15, color: '#0078d4' },
        { id: 'gcp-hub', type: 'GCP', name: 'Google Cloud', x: 0.6, y: 0.15, color: '#4285f4' }
      ];
      
      const megaportClouds = getFilteredMegaportLocations.map((mp, index) => ({
        id: mp.id,
        type: 'NaaS',
        name: mp.name,
        x: mp.x,
        y: 0.45,
        color: '#f97316'
      }));
      
      return [...hyperscalers, ...megaportClouds, ...customClouds];
    }
    
    return [...baseWanClouds, ...customClouds];
  }, [isOptimizationView, getFilteredMegaportLocations, customClouds]);

  // Initialize site positions
  useEffect(() => {
    if (sites.length === 0) return;

    const positions: Record<string, { x: number; y: number }> = {};

    sites.forEach((site, index) => {
      if (site.coordinates && site.coordinates.x !== undefined && site.coordinates.y !== undefined) {
        positions[site.id] = {
          x: site.coordinates.x * dimensions.width,
          y: site.coordinates.y * dimensions.height
        };
      } else {
        if (isOptimizationView) {
          // Position sites at bottom in geographic order
          const siteX = 0.1 + (index / Math.max(1, sites.length - 1)) * 0.8;
          positions[site.id] = {
            x: siteX * dimensions.width,
            y: 0.75 * dimensions.height
          };
        } else {
          // Default circular arrangement
          const angle = (index / sites.length) * 2 * Math.PI;
          const radiusX = dimensions.width * 0.3;
          const radiusY = dimensions.height * 0.3;
          const centerX = dimensions.width * 0.5;
          const centerY = dimensions.height * 0.5;

          positions[site.id] = {
            x: centerX + Math.cos(angle) * radiusX,
            y: centerY + Math.sin(angle) * radiusY
          };
        }
      }
    });

    setSitePositions(positions);
  }, [sites, dimensions, isOptimizationView]);

  // Initialize cloud positions
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    
    getCurrentClouds.forEach(cloud => {
      positions[cloud.id] = {
        x: cloud.x * dimensions.width,
        y: cloud.y * dimensions.height
      };
    });
    
    setCloudPositions(positions);
  }, [dimensions, getCurrentClouds]);

  // Update canvas dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const container = svgRef.current.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          setDimensions({ 
            width: Math.max(800, rect.width - 40), 
            height: Math.max(600, rect.height - 40) 
          });
        }
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const getSiteIcon = (category: string) => {
    switch (category) {
      case 'Corporate': return Building2;
      case 'Branch': return Building2;
      case 'Data Center': return Server;
      case 'Cloud': return Database;
      default: return Building2;
    }
  };

  const getSiteColor = (category: string) => {
    switch (category) {
      case 'Corporate': return '#6366f1';
      case 'Branch': return '#3b82f6';
      case 'Data Center': return '#f97316';
      case 'Cloud': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const getTargetCloud = (connection: Connection): WANCloud | null => {
    const type = connection.type.toLowerCase();
    const provider = connection.provider?.toLowerCase() || '';

    if (type.includes('aws') || type.includes('direct connect') || provider.includes('aws')) {
      return getCurrentClouds.find(c => c.type === 'AWS') || null;
    }

    if (type.includes('azure') || type.includes('expressroute') || provider.includes('azure')) {
      return getCurrentClouds.find(c => c.type === 'Azure') || null;
    }

    if (type.includes('gcp') || type.includes('google') || provider.includes('google')) {
      return getCurrentClouds.find(c => c.type === 'GCP') || null;
    }

    if (type.includes('mpls') || type.includes('vpls')) {
      return getCurrentClouds.find(c => c.type === 'MPLS') || null;
    }

    if (type.includes('internet') || type.includes('broadband') || type.includes('lte') || 
        type.includes('satellite') || type.includes('dedicated internet')) {
      return getCurrentClouds.find(c => c.type === 'Internet') || null;
    }

    if (type.includes('megaport') || type.includes('sd-wan') || type.includes('naas')) {
      return getCurrentClouds.find(c => c.type === 'NaaS') || null;
    }

    return getCurrentClouds.find(c => c.type === 'Internet') || null;
  };

  // Drag handlers for sites
  const handleMouseDown = useCallback((siteId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(siteId);
  }, []);

  // Drag handlers for WAN clouds
  const handleCloudMouseDown = useCallback((cloudId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCloud(cloudId);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const constrainedX = Math.max(40, Math.min(dimensions.width - 40, x));
      const constrainedY = Math.max(40, Math.min(dimensions.height - 40, y));

      setSitePositions(prev => ({
        ...prev,
        [isDragging]: { x: constrainedX, y: constrainedY }
      }));

      onUpdateSiteCoordinates(isDragging, {
        x: constrainedX / dimensions.width,
        y: constrainedY / dimensions.height
      });

      setHasUnsavedChanges(true);
    } else if (isDraggingCloud) {
      const constrainedX = Math.max(40, Math.min(dimensions.width - 40, x));
      const constrainedY = Math.max(40, Math.min(dimensions.height - 40, y));

      setCloudPositions(prev => ({
        ...prev,
        [isDraggingCloud]: { x: constrainedX, y: constrainedY }
      }));

      setHasUnsavedChanges(true);
    }
  }, [isDragging, isDraggingCloud, dimensions, onUpdateSiteCoordinates]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
    setIsDraggingCloud(null);
  }, []);

  const renderConnections = () => {
    const connections: React.ReactElement[] = [];
    
    if (!connectionVisibility.siteToCloud && !connectionVisibility.mplsMesh) {
      return connections;
    }

    sites.forEach(site => {
      const sitePos = sitePositions[site.id];
      if (!sitePos) return;

      if (isOptimizationView) {
        // In optimization view, connect sites to nearest Megaport
        const nearestMegaport = getFilteredMegaportLocations[0];
        if (nearestMegaport) {
          const targetCloud = getCurrentClouds.find(c => c.id === nearestMegaport.id);
          if (targetCloud) {
            const cloudPos = cloudPositions[targetCloud.id];
            if (cloudPos) {
              connections.push(
                <line
                  key={`opt-${site.id}-${targetCloud.id}`}
                  x1={sitePos.x}
                  y1={sitePos.y}
                  x2={cloudPos.x}
                  y2={cloudPos.y}
                  stroke="#f97316"
                  strokeWidth="2"
                  strokeOpacity="0.6"
                />
              );
            }
          }
        }
      } else {
        // Regular view connections
        site.connections.forEach((connection, connectionIndex) => {
          const targetCloud = getTargetCloud(connection);
          if (!targetCloud) return;

          const cloudPos = cloudPositions[targetCloud.id];
          if (!cloudPos) return;

          connections.push(
            <line
              key={`${site.id}-${targetCloud.id}-${connectionIndex}`}
              x1={sitePos.x}
              y1={sitePos.y}
              x2={cloudPos.x}
              y2={cloudPos.y}
              stroke={targetCloud.color}
              strokeWidth="2"
              strokeOpacity="0.6"
            />
          );
        });
      }
    });

    return connections;
  };

  const renderClouds = () => {
    return getCurrentClouds.map(cloud => {
      const position = cloudPositions[cloud.id];
      if (!position) return null;

      return (
        <g 
          key={cloud.id}
          style={{ cursor: isDraggingCloud === cloud.id ? 'grabbing' : 'grab' }}
          onMouseDown={handleCloudMouseDown(cloud.id)}
        >
          <circle
            cx={position.x}
            cy={position.y}
            r={30}
            fill={cloud.color}
            fillOpacity="0.1"
            stroke={cloud.color}
            strokeWidth="2"
          />
          <foreignObject
            x={position.x - 12}
            y={position.y - 12}
            width="24"
            height="24"
            style={{ pointerEvents: 'none' }}
          >
            <Cloud className="w-6 h-6" color={cloud.color} />
          </foreignObject>
          <text
            x={position.x}
            y={position.y + 45}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill={cloud.color}
          >
            {cloud.name}
          </text>
        </g>
      );
    });
  };

  const renderSites = () => {
    return sites.map(site => {
      const position = sitePositions[site.id];
      if (!position) return null;

      const IconComponent = getSiteIcon(site.category);
      const siteColor = getSiteColor(site.category);
      const isSelected = selectedSite?.id === site.id;

      return (
        <g
          key={site.id}
          style={{ cursor: isDragging === site.id ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown(site.id)}
          onClick={() => onSelectSite?.(site)}
        >
          <circle
            cx={position.x}
            cy={position.y}
            r={isSelected ? 25 : 20}
            fill={siteColor}
            stroke={isSelected ? "#000" : "white"}
            strokeWidth={isSelected ? 3 : 2}
          />
          <foreignObject
            x={position.x - 10}
            y={position.y - 10}
            width="20"
            height="20"
            style={{ pointerEvents: 'none' }}
          >
            <IconComponent className="w-5 h-5 text-white" />
          </foreignObject>
          <text
            x={position.x}
            y={position.y + 35}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="#374151"
          >
            {site.name}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="w-full h-full bg-gray-50 relative">
      <div 
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="border border-gray-200 rounded-lg bg-white"
        >
          {renderConnections()}
          {renderClouds()}
          {renderSites()}
        </svg>
      </div>

      {/* Controls Panel */}
      <div className="absolute top-4 right-4 space-y-3">
        {/* View Toggle */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
          <Button
            size="sm"
            onClick={() => setIsOptimizationView(!isOptimizationView)}
            className={isOptimizationView ? "bg-orange-500 hover:bg-orange-600" : ""}
          >
            <Settings className="h-4 w-4 mr-1" />
            {isOptimizationView ? 'Standard View' : 'Optimize View'}
          </Button>
        </div>

        {/* Optimization Controls */}
        {isOptimizationView && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
            <Label className="text-xs font-medium text-gray-700">Distance Tolerance</Label>
            <div className="mt-2">
              <Slider
                value={distanceThreshold}
                onValueChange={setDistanceThreshold}
                max={800}
                min={100}
                step={50}
                className="w-32"
              />
              <div className="text-xs text-gray-500 mt-1">
                {distanceThreshold[0]}km
              </div>
            </div>
          </div>
        )}

        {/* Add Onramp Button */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
          <Button
            size="sm"
            onClick={() => setShowAddOnrampDialog(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <MapPin className="h-4 w-4 mr-1" />
            Add Megaport Onramp
          </Button>
        </div>

        {/* Save Button */}
        {onSaveDesign && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
            <Button
              size="sm"
              onClick={() => {
                onSaveDesign();
                setHasUnsavedChanges(false);
                setShowSaveIndicator(true);
                setTimeout(() => setShowSaveIndicator(false), 2000);
              }}
              className={hasUnsavedChanges ? "bg-green-500 hover:bg-green-600" : ""}
            >
              <Save className="h-4 w-4 mr-1" />
              {hasUnsavedChanges ? 'Save Changes' : 'Save Design'}
            </Button>
            {showSaveIndicator && (
              <span className="text-green-600 text-xs font-medium ml-2">Saved!</span>
            )}
          </div>
        )}
      </div>

      {/* Site Edit Dialog - Disabled due to type conflicts */}
      {/* {editingSite && (
        <SiteEditDialog
          site={editingSite}
          open={!!editingSite}
          onClose={() => setEditingSite(null)}
          onSave={(siteId, updates) => {
            if (onUpdateSite) {
              onUpdateSite(siteId, updates);
              setHasUnsavedChanges(true);
            }
          }}
          onDelete={onDeleteSite || (() => {})}
        />
      )} */}

      {/* Add Megaport Onramp Dialog */}
      <AddMegaportOnrampDialog
        open={showAddOnrampDialog}
        onClose={() => setShowAddOnrampDialog(false)}
        onAdd={() => {
          setHasUnsavedChanges(true);
        }}
      />
    </div>
  );
}
