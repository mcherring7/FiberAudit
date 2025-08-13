
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

interface TopologyViewerProps {
  sites: Site[];
  selectedSite?: Site | null;
  onSelectSite?: (site: Site | null) => void;
  onUpdateSiteCoordinates: (siteId: string, coordinates: { x: number; y: number }) => void;
  onUpdateSite?: (siteId: string, updates: Partial<Site>) => void;
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
  const [dimensions, setDimensions] = useState({ width: 1400, height: 900 });
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [editingSite, setEditingSite] = useState<Site | null>(null);
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

  // Base WAN cloud definitions
  const baseWanClouds: WANCloud[] = [
    { id: 'internet', type: 'Internet', name: 'Internet WAN', x: 0.35, y: 0.5, color: '#3b82f6' },
    { id: 'mpls', type: 'MPLS', name: 'MPLS WAN', x: 0.65, y: 0.5, color: '#8b5cf6' },
    { id: 'azure-hub', type: 'Azure', name: 'Azure ExpressRoute', x: 0.8, y: 0.2, color: '#0078d4' },
    { id: 'aws-hub', type: 'AWS', name: 'AWS Direct Connect', x: 0.2, y: 0.2, color: '#ff9900' },
    { id: 'gcp-hub', type: 'GCP', name: 'Google Cloud', x: 0.5, y: 0.2, color: '#4285f4' },
    { id: 'megaport', type: 'NaaS', name: 'Megaport NaaS', x: 0.5, y: 0.5, color: '#f97316' }
  ];

  // Get actual WAN clouds with current positions
  const allClouds = [...baseWanClouds, ...customClouds];
  const wanClouds: WANCloud[] = allClouds.map(cloud => ({
    ...cloud,
    x: cloudPositions[cloud.id]?.x !== undefined ? cloudPositions[cloud.id].x / dimensions.width : cloud.x,
    y: cloudPositions[cloud.id]?.y !== undefined ? cloudPositions[cloud.id].y / dimensions.height : cloud.y,
  }));

  // Initialize site positions
  useEffect(() => {
    if (!sites.length) return;

    const positions: Record<string, { x: number; y: number }> = {};

    sites.forEach((site, index) => {
      if (site.coordinates) {
        positions[site.id] = {
          x: site.coordinates.x * dimensions.width,
          y: site.coordinates.y * dimensions.height
        };
      } else {
        const angle = (index / sites.length) * 2 * Math.PI;
        const radiusX = dimensions.width * 0.35;
        const radiusY = dimensions.height * 0.35;
        const centerX = dimensions.width * 0.5;
        const centerY = dimensions.height * 0.5;

        positions[site.id] = {
          x: centerX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle) * radiusY
        };
      }
    });

    setSitePositions(positions);
  }, [sites, dimensions]);

  // Initialize WAN cloud positions
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const visibility: Record<string, boolean> = {};

    [...baseWanClouds, ...customClouds].forEach(cloud => {
      positions[cloud.id] = {
        x: cloud.x * dimensions.width,
        y: cloud.y * dimensions.height
      };

      if (!(cloud.id in cloudVisibility)) {
        visibility[cloud.id] = true;
      }
    });

    setCloudPositions(positions);

    if (Object.keys(visibility).length > 0) {
      setCloudVisibility(prev => ({ ...prev, ...visibility }));
    }
  }, [dimensions, customClouds.length]);

  // Update canvas dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
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
      return wanClouds.find(c => c.type === 'AWS') || null;
    }

    if (type.includes('azure') || type.includes('expressroute') || provider.includes('azure')) {
      return wanClouds.find(c => c.type === 'Azure') || null;
    }

    if (type.includes('gcp') || type.includes('google') || provider.includes('google')) {
      return wanClouds.find(c => c.type === 'GCP') || null;
    }

    if (type.includes('mpls') || type.includes('vpls')) {
      return wanClouds.find(c => c.type === 'MPLS') || null;
    }

    if (type.includes('internet') || type.includes('broadband') || type.includes('lte') || 
        type.includes('satellite') || type.includes('dedicated internet')) {
      return wanClouds.find(c => c.type === 'Internet') || null;
    }

    if (type.includes('megaport') || type.includes('sd-wan') || type.includes('naas')) {
      return wanClouds.find(c => c.type === 'NaaS') || null;
    }

    return wanClouds.find(c => c.type === 'Internet') || null;
  };

  // Drag handlers for sites
  const handleMouseDown = useCallback((siteId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const adjustedMouseX = (mouseX - panOffset.x) / zoom;
    const adjustedMouseY = (mouseY - panOffset.y) / zoom;

    const sitePos = sitePositions[siteId];
    if (sitePos) {
      setDragOffset({
        x: adjustedMouseX - sitePos.x,
        y: adjustedMouseY - sitePos.y
      });
    }

    setIsDragging(siteId);
  }, [sitePositions, panOffset, zoom]);

  // Drag handlers for WAN clouds
  const handleCloudMouseDown = useCallback((cloudId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const adjustedMouseX = (mouseX - panOffset.x) / zoom;
    const adjustedMouseY = (mouseY - panOffset.y) / zoom;

    const cloudPos = cloudPositions[cloudId];
    if (cloudPos) {
      setDragOffset({
        x: adjustedMouseX - cloudPos.x,
        y: adjustedMouseY - cloudPos.y
      });
    }

    setIsDraggingCloud(cloudId);
  }, [cloudPositions, panOffset, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const adjustedX = (x - panOffset.x) / zoom;
    const adjustedY = (y - panOffset.y) / zoom;

    if (isPanning) {
      const deltaX = x - lastPanPoint.x;
      const deltaY = y - lastPanPoint.y;

      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setLastPanPoint({ x, y });
    } else if (isDragging) {
      const targetX = adjustedX - dragOffset.x;
      const targetY = adjustedY - dragOffset.y;
      const constrainedX = Math.max(60, Math.min(dimensions.width - 60, targetX));
      const constrainedY = Math.max(60, Math.min(dimensions.height - 60, targetY));

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
      const targetX = adjustedX - dragOffset.x;
      const targetY = adjustedY - dragOffset.y;
      const constrainedX = Math.max(60, Math.min(dimensions.width - 60, targetX));
      const constrainedY = Math.max(60, Math.min(dimensions.height - 60, targetY));

      setCloudPositions(prev => ({
        ...prev,
        [isDraggingCloud]: { x: constrainedX, y: constrainedY }
      }));

      onUpdateWANCloud?.(isDraggingCloud, {
        x: constrainedX / dimensions.width,
        y: constrainedY / dimensions.height
      });

      setHasUnsavedChanges(true);
    }
  }, [isDragging, isDraggingCloud, isPanning, lastPanPoint, panOffset, zoom, dimensions, onUpdateSiteCoordinates, onUpdateWANCloud, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
    setIsDraggingCloud(null);
    setIsPanning(false);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement | SVGElement;
    const isClickOnBackground = target === svgRef.current || 
                               target.tagName === 'svg' || 
                               target.tagName === 'rect' ||
                               (target as any).id === 'svg-background';

    if (e.button === 0 && !isDragging && !isDraggingCloud && isClickOnBackground) {
      e.preventDefault();
      setIsPanning(true);
      const rect = svgRef.current!.getBoundingClientRect();
      setLastPanPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, [isDragging, isDraggingCloud]);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const zoomFactor = direction === 'in' ? 1.2 : 1 / 1.2;
    const newZoom = Math.max(0.5, Math.min(3, zoom * zoomFactor));
    setZoom(newZoom);
  }, [zoom]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const getActiveClouds = (): WANCloud[] => {
    const usedCloudTypes = new Set<string>();

    sites.forEach(site => {
      site.connections.forEach(connection => {
        const cloud = getTargetCloud(connection);
        if (cloud) usedCloudTypes.add(cloud.type);
      });
    });

    return wanClouds.filter(cloud => {
      const isCustomCloud = customClouds.some(c => c.id === cloud.id);
      const hasConnections = usedCloudTypes.has(cloud.type);
      const isNotHidden = !hiddenClouds.has(cloud.id);

      return isNotHidden && (isCustomCloud || hasConnections);
    });
  };

  const renderConnections = () => {
    const connections: React.ReactElement[] = [];
    const activeClouds = getActiveClouds();

    const mplsSites = sites.filter(site => 
      site.connections.some(conn => conn.type.toLowerCase().includes('mpls'))
    );

    if (connectionVisibility.mplsMesh && mplsSites.length > 1) {
      mplsSites.forEach((siteA, indexA) => {
        const posA = sitePositions[siteA.id];
        if (!posA) return;

        mplsSites.forEach((siteB, indexB) => {
          if (indexA >= indexB) return;

          const posB = sitePositions[siteB.id];
          if (!posB) return;

          const isHighlighted = hoveredSite === siteA.id || hoveredSite === siteB.id ||
                               selectedSite?.id === siteA.id || selectedSite?.id === siteB.id;

          connections.push(
            <line
              key={`mpls-mesh-${siteA.id}-${siteB.id}`}
              x1={posA.x}
              y1={posA.y}
              x2={posB.x}
              y2={posB.y}
              stroke="#8b5cf6"
              strokeWidth={isHighlighted ? "2" : "1"}
              strokeOpacity={isHighlighted ? 0.8 : 0.4}
              strokeDasharray="3,3"
            />
          );
        });
      });
    }

    if (connectionVisibility.siteToCloud) {
      sites.forEach(site => {
        const sitePos = sitePositions[site.id];
        if (!sitePos) return;

        site.connections.forEach((connection, index) => {
          const targetCloud = getTargetCloud(connection);
          if (!targetCloud || !activeClouds.find(c => c.id === targetCloud.id)) return;

          if (!cloudVisibility[targetCloud.id]) return;

          const cloudCenterX = targetCloud.x * dimensions.width;
          const cloudCenterY = targetCloud.y * dimensions.height;

          const cloudRadius = (targetCloud.type === 'Internet' || targetCloud.type === 'MPLS') ? 60 : 45;
          const angle = Math.atan2(cloudCenterY - sitePos.y, cloudCenterX - sitePos.x);
          const cloudEdgeX = cloudCenterX - Math.cos(angle) * cloudRadius;
          const cloudEdgeY = cloudCenterY - Math.sin(angle) * cloudRadius;

          const connectionId = `${site.id}-${targetCloud.id}-${index}`;
          const isHighlighted = hoveredSite === site.id || selectedSite?.id === site.id;

          connections.push(
            <line
              key={connectionId}
              x1={sitePos.x}
              y1={sitePos.y}
              x2={cloudEdgeX}
              y2={cloudEdgeY}
              stroke={targetCloud.color}
              strokeWidth={isHighlighted ? "3" : "2"}
              strokeOpacity={isHighlighted ? 1 : 0.6}
              strokeDasharray={targetCloud.type === 'Internet' ? '5,5' : '0'}
            />
          );

          if (connectionVisibility.bandwidthLabels) {
            const midX = (sitePos.x + cloudEdgeX) / 2;
            const midY = (sitePos.y + cloudEdgeY) / 2;

            connections.push(
              <g key={`label-${connectionId}`}>
                <rect
                  x={midX - 20}
                  y={midY - 8}
                  width="40"
                  height="16"
                  fill="white"
                  stroke="#e5e7eb"
                  rx="3"
                  opacity={isHighlighted ? 1 : 0.8}
                />
                <text
                  x={midX}
                  y={midY + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                  fontWeight="500"
                >
                  {connection.bandwidth}
                </text>
              </g>
            );
          }
        });
      });
    }

    return connections;
  };

  const renderClouds = () => {
    return getActiveClouds().map(cloud => {
      if (hiddenClouds.has(cloud.id) || !cloudVisibility[cloud.id]) return null;
      const x = cloud.x * dimensions.width;
      const y = cloud.y * dimensions.height;

      const radius = (cloud.type === 'Internet' || cloud.type === 'MPLS') ? 60 : 45;
      const iconSize = (cloud.type === 'Internet' || cloud.type === 'MPLS') ? 28 : 20;

      return (
        <g 
          key={cloud.id}
          style={{ cursor: isDraggingCloud === cloud.id ? 'grabbing' : 'grab' }}
          onMouseDown={handleCloudMouseDown(cloud.id)}
        >
          <circle
            cx={x}
            cy={y}
            r={radius}
            fill={cloud.color}
            fillOpacity="0.1"
            stroke={cloud.color}
            strokeWidth={cloud.type === 'Internet' || cloud.type === 'MPLS' ? "3" : "2"}
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' }}
          />

          <circle
            cx={x}
            cy={y}
            r={iconSize/1.5}
            fill="white"
            fillOpacity="0.9"
            stroke={cloud.color}
            strokeWidth="1"
          />

          <foreignObject
            x={x - iconSize/2}
            y={y - iconSize/2}
            width={iconSize}
            height={iconSize}
            style={{ pointerEvents: 'none' }}
          >
            <Cloud className={`w-full h-full drop-shadow-sm`} color={cloud.color} />
          </foreignObject>

          <text
            x={x}
            y={y + radius + 15}
            textAnchor="middle"
            fontSize={cloud.type === 'Internet' || cloud.type === 'MPLS' ? "14" : "12"}
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
      const isHovered = hoveredSite === site.id;

      return (
        <g
          key={site.id}
          style={{ cursor: isDragging === site.id ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown(site.id)}
          onMouseEnter={() => setHoveredSite(site.id)}
          onMouseLeave={() => setHoveredSite(null)}
          onClick={() => onSelectSite?.(site)}
        >
          <circle
            cx={position.x}
            cy={position.y}
            r={isSelected ? "28" : "22"}
            fill={siteColor}
            stroke={isSelected ? "#000" : "white"}
            strokeWidth={isSelected ? "3" : "2"}
            opacity={isHovered || isSelected ? 1 : 0.85}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
          />

          <circle
            cx={position.x}
            cy={position.y}
            r={isSelected ? "18" : "14"}
            fill="rgba(255,255,255,0.2)"
            opacity="0.8"
          />

          <foreignObject
            x={position.x - (isSelected ? 12 : 10)}
            y={position.y - (isSelected ? 12 : 10)}
            width={isSelected ? "24" : "20"}
            height={isSelected ? "24" : "20"}
            style={{ pointerEvents: 'none' }}
          >
            <IconComponent className={`${isSelected ? 'w-6 h-6' : 'w-5 h-5'} text-white drop-shadow-sm`} />
          </foreignObject>

          <text
            x={position.x}
            y={position.y + (isSelected ? 40 : 35)}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#374151"
            style={{ pointerEvents: 'none' }}
          >
            {site.name}
          </text>

          <text
            x={position.x}
            y={position.y + (isSelected ? 52 : 47)}
            textAnchor="middle"
            fontSize="10"
            fill="#6b7280"
            style={{ pointerEvents: 'none' }}
          >
            {site.category}
          </text>

          {isSelected && onAddConnection && (
            <g>
              <circle
                cx={position.x + 30}
                cy={position.y - 15}
                r="12"
                fill="#10b981"
                stroke="white"
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddConnection(site.id);
                }}
              />
              <text
                x={position.x + 30}
                y={position.y - 10}
                textAnchor="middle"
                fontSize="16"
                fontWeight="bold"
                fill="white"
                style={{ pointerEvents: 'none' }}
              >
                +
              </text>
            </g>
          )}
        </g>
      );
    });
  };

  return (
    <div className="w-full h-full bg-gray-50 relative overflow-hidden">
      <div 
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : isDragging ? 'grabbing' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="border border-gray-200 rounded-lg"
          style={{
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
            cursor: isPanning ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleCanvasMouseDown}
        >
          <rect
            id="svg-background"
            width={dimensions.width}
            height={dimensions.height}
            fill="transparent"
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          />

          {renderConnections()}
          {renderClouds()}
          {renderSites()}
        </svg>
      </div>

      {/* Controls Panel */}
      <div className="absolute top-4 right-4 space-y-3">
        {/* Save Design Button */}
        {onSaveDesign && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onSaveDesign();
                  setHasUnsavedChanges(false);
                  setShowSaveIndicator(true);
                  setTimeout(() => setShowSaveIndicator(false), 2000);
                }}
                className={hasUnsavedChanges ? "bg-orange-500 hover:bg-orange-600" : ""}
              >
                <Save className="h-4 w-4 mr-1" />
                {hasUnsavedChanges ? 'Save Changes' : 'Save Design'}
              </Button>
              {showSaveIndicator && (
                <span className="text-green-600 text-xs font-medium">Saved!</span>
              )}
              {hasUnsavedChanges && (
                <AlertCircle className="h-4 w-4 text-orange-500" />
              )}
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
          <div className="p-3">
            <span className="text-xs font-medium text-gray-700">View Controls</span>
            <div className="mt-2 space-y-2">
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleZoom('in')}
                  className="px-2 py-1 text-xs"
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
                <span className="text-xs text-gray-600 px-2">{Math.round(zoom * 100)}%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleZoom('out')}
                  className="px-2 py-1 text-xs"
                >
                  <ZoomOut className="h-3 w-3" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetView}
                className="w-full text-xs"
              >
                Reset View
              </Button>
            </div>
          </div>
        </div>

        {/* Connection Visibility Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
          <div className="p-3">
            <span className="text-xs font-medium text-gray-700">Connection Lines</span>
            <div className="mt-2 space-y-2">
              <div className="space-y-1">
                <label className="flex items-center space-x-2 text-xs">
                  <input
                    type="checkbox"
                    checked={connectionVisibility.siteToCloud}
                    onChange={(e) => setConnectionVisibility(prev => ({
                      ...prev,
                      siteToCloud: e.target.checked
                    }))}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Site-to-Cloud</span>
                </label>
                <label className="flex items-center space-x-2 text-xs">
                  <input
                    type="checkbox"
                    checked={connectionVisibility.mplsMesh}
                    onChange={(e) => setConnectionVisibility(prev => ({
                      ...prev,
                      mplsMesh: e.target.checked
                    }))}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>MPLS Mesh</span>
                </label>
                <label className="flex items-center space-x-2 text-xs">
                  <input
                    type="checkbox"
                    checked={connectionVisibility.bandwidthLabels}
                    onChange={(e) => setConnectionVisibility(prev => ({
                      ...prev,
                      bandwidthLabels: e.target.checked
                    }))}
                    className="rounded text-gray-600 focus:ring-gray-500"
                  />
                  <span>Bandwidth Labels</span>
                </label>

                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">Individual Clouds:</div>
                  {getActiveClouds().map(cloud => (
                    <label key={cloud.id} className="flex items-center space-x-2 text-xs">
                      <input
                        type="checkbox"
                        checked={cloudVisibility[cloud.id] ?? true}
                        onChange={(e) => setCloudVisibility(prev => ({
                          ...prev,
                          [cloud.id]: e.target.checked
                        }))}
                        className="rounded focus:ring-2"
                        style={{ accentColor: cloud.color }}
                      />
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: cloud.color }}
                      />
                      <span>{cloud.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add WAN Cloud Button */}
        {onAddWANCloud && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
            <Button
              size="sm"
              onClick={() => setShowAddCloudDialog(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Cloud className="h-4 w-4 mr-1" />
              Add WAN Cloud
            </Button>
          </div>
        )}

        {/* Add Megaport Onramp Button */}
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

        {/* Legend */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Network Architecture</h3>
          <div className="space-y-2">
            {getActiveClouds().map(cloud => (
              <div key={cloud.id} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-0.5" 
                  style={{ backgroundColor: cloud.color }}
                />
                <span>{cloud.name}</span>
              </div>
            ))}
            {sites.some(site => site.connections.some(conn => conn.type.toLowerCase().includes('mpls'))) && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-0.5 bg-purple-400 opacity-60" style={{ borderTop: '1px dashed #8b5cf6' }} />
                <span>MPLS Mesh</span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="space-y-1">
              <p className="text-xs text-gray-600">• Double-click sites/clouds to edit</p>
              <p className="text-xs text-gray-600">• Drag sites to reposition</p>
              <p className="text-xs text-gray-600">• MPLS creates mesh connectivity</p>
            </div>
          </div>
        </div>
      </div>

      {/* Site Edit Dialog */}
      {editingSite && (
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
          onDelete={onDeleteSite ? (siteId) => {
            onDeleteSite(siteId);
            setHasUnsavedChanges(true);
          } : undefined}
        />
      )}

      {/* WAN Cloud Edit Dialog */}
      {editingWANCloud && (
        <WANCloudEditDialog
          cloud={editingWANCloud}
          open={!!editingWANCloud}
          onClose={() => setEditingWANCloud(null)}
          onSave={(cloudId, updates) => {
            if (onUpdateWANCloud) {
              onUpdateWANCloud(cloudId, updates);
              setHasUnsavedChanges(true);
            }
          }}
          onDelete={onDeleteWANCloud ? (cloudId) => {
            onDeleteWANCloud(cloudId);
            setHasUnsavedChanges(true);
          } : undefined}
          onHide={(cloudId) => {
            setHiddenClouds(prev => {
              const newSet = new Set(prev);
              newSet.add(cloudId);
              return newSet;
            });
            setHasUnsavedChanges(true);
          }}
        />
      )}

      {/* Add WAN Cloud Dialog */}
      <AddWANCloudDialog
        open={showAddCloudDialog}
        onClose={() => setShowAddCloudDialog(false)}
        onAdd={(cloud) => {
          onAddWANCloud?.(cloud);
          setHasUnsavedChanges(true);
        }}
      />

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
