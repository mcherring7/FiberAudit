import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Building2, Server, Database, Cloud, Edit3, Save, AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SiteEditDialog from './site-edit-dialog';
import WANCloudEditDialog from './wan-cloud-edit-dialog';
import AddWANCloudDialog from './add-wan-cloud-dialog';

// Use the exact same Site interface as the parent component
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

interface WANCloud {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  color: string;
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
    siteToCloud: true,        // Site-to-WAN cloud connections
    mplsMesh: true,           // MPLS mesh (site-to-site) connections
    bandwidthLabels: true,    // Bandwidth labels on connections
    pointToPoint: true        // Point-to-point connections
  });
  
  // Individual WAN cloud visibility controls
  const [cloudVisibility, setCloudVisibility] = useState<Record<string, boolean>>({
    internet: true,
    mpls: true,
    'azure-hub': true,
    megaport: true
  });
  const [showAddCloudDialog, setShowAddCloudDialog] = useState(false);

  // Base WAN cloud definitions - positions will be overridden by cloudPositions state
  const baseWanClouds: WANCloud[] = [
    { id: 'internet', type: 'Internet', name: 'Internet WAN', x: 0.35, y: 0.5, color: '#3b82f6' },
    { id: 'mpls', type: 'MPLS', name: 'MPLS WAN', x: 0.65, y: 0.5, color: '#8b5cf6' },
    { id: 'azure-hub', type: 'Azure', name: 'Azure ExpressRoute', x: 0.8, y: 0.2, color: '#0078d4' },
    { id: 'megaport', type: 'NaaS', name: 'Megaport NaaS', x: 0.5, y: 0.8, color: '#f97316' }
  ];

  // Get actual WAN clouds with current positions (base + custom)
  const allClouds = [...baseWanClouds, ...customClouds];
  const wanClouds: WANCloud[] = allClouds.map(cloud => ({
    ...cloud,
    x: cloudPositions[cloud.id]?.x !== undefined ? cloudPositions[cloud.id].x / dimensions.width : cloud.x,
    y: cloudPositions[cloud.id]?.y !== undefined ? cloudPositions[cloud.id].y / dimensions.height : cloud.y,
  }));

  // Initialize and update site positions
  useEffect(() => {
    if (!sites.length) return;

    const positions: Record<string, { x: number; y: number }> = {};
    
    sites.forEach((site, index) => {
      if (site.coordinates) {
        // Convert normalized coordinates to pixels
        positions[site.id] = {
          x: site.coordinates.x * dimensions.width,
          y: site.coordinates.y * dimensions.height
        };
      } else {
        // Default positioning around the perimeter
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

  // Initialize WAN cloud positions and visibility
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const visibility: Record<string, boolean> = {};
    
    [...baseWanClouds, ...customClouds].forEach(cloud => {
      // Convert normalized coordinates to pixels for initial positions
      positions[cloud.id] = {
        x: cloud.x * dimensions.width,
        y: cloud.y * dimensions.height
      };
      
      // Initialize visibility for all clouds (including custom ones)
      if (!(cloud.id in cloudVisibility)) {
        visibility[cloud.id] = true;
      }
    });
    
    setCloudPositions(positions);
    
    // Update cloud visibility state for new clouds
    if (Object.keys(visibility).length > 0) {
      setCloudVisibility(prev => ({ ...prev, ...visibility }));
    }
  }, [dimensions, customClouds.length, cloudVisibility]);

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

  // Determine which cloud a connection should target
  const getTargetCloud = (connection: Connection): WANCloud | null => {
    const type = connection.type.toLowerCase();
    const provider = connection.provider?.toLowerCase() || '';
    
    // AWS Direct Connect connections - route to Internet cloud (treated as connection type, not separate cloud)
    if (type.includes('aws') || type.includes('direct connect') || provider.includes('aws')) {
      return wanClouds.find(c => c.type === 'Internet') || null;
    }
    
    // Azure ExpressRoute connections
    if (type.includes('azure') || type.includes('expressroute') || provider.includes('azure')) {
      return wanClouds.find(c => c.type === 'Azure') || null;
    }
    
    // MPLS connections - primary hub
    if (type.includes('mpls') || type.includes('vpls')) {
      return wanClouds.find(c => c.type === 'MPLS') || null;
    }
    
    // Internet connections - primary hub
    if (type.includes('internet') || type.includes('broadband') || type.includes('lte') || 
        type.includes('satellite') || type.includes('dedicated internet')) {
      return wanClouds.find(c => c.type === 'Internet') || null;
    }
    
    // Megaport/SD-WAN connections
    if (type.includes('megaport') || type.includes('sd-wan') || type.includes('naas')) {
      return wanClouds.find(c => c.type === 'NaaS') || null;
    }
    
    // Default to Internet for unknown types
    return wanClouds.find(c => c.type === 'Internet') || null;
  };

  // Drag handlers for sites
  const handleMouseDown = useCallback((siteId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas pan from starting
    
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Account for zoom and pan offset
    const adjustedMouseX = (mouseX - panOffset.x) / zoom;
    const adjustedMouseY = (mouseY - panOffset.y) / zoom;
    
    // Calculate offset between mouse position and site center
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
    
    // Account for zoom and pan offset
    const adjustedMouseX = (mouseX - panOffset.x) / zoom;
    const adjustedMouseY = (mouseY - panOffset.y) / zoom;
    
    // Calculate offset between mouse position and cloud center
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

    // Account for zoom and pan offset
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
      // Apply drag offset to maintain cursor position relative to site center
      const targetX = adjustedX - dragOffset.x;
      const targetY = adjustedY - dragOffset.y;
      
      // Constrain to extended canvas boundaries
      const constrainedX = Math.max(60, Math.min(dimensions.width - 60, targetX));
      const constrainedY = Math.max(60, Math.min(dimensions.height - 60, targetY));

      // Update site position immediately for real-time feedback
      setSitePositions(prev => ({
        ...prev,
        [isDragging]: { x: constrainedX, y: constrainedY }
      }));

      // Update parent component with normalized coordinates
      onUpdateSiteCoordinates(isDragging, {
        x: constrainedX / dimensions.width,
        y: constrainedY / dimensions.height
      });
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
    } else if (isDraggingCloud) {
      // Apply drag offset to maintain cursor position relative to cloud center
      const targetX = adjustedX - dragOffset.x;
      const targetY = adjustedY - dragOffset.y;
      
      // Constrain to extended canvas boundaries
      const constrainedX = Math.max(60, Math.min(dimensions.width - 60, targetX));
      const constrainedY = Math.max(60, Math.min(dimensions.height - 60, targetY));

      // Update WAN cloud position immediately for real-time feedback
      setCloudPositions(prev => ({
        ...prev,
        [isDraggingCloud]: { x: constrainedX, y: constrainedY }
      }));

      // Update parent component with normalized coordinates
      onUpdateWANCloud?.(isDraggingCloud, {
        x: constrainedX / dimensions.width,
        y: constrainedY / dimensions.height
      });
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
    }
  }, [isDragging, isDraggingCloud, isPanning, lastPanPoint, panOffset, zoom, dimensions, onUpdateSiteCoordinates, onUpdateWANCloud]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
    setIsDraggingCloud(null);
    setIsPanning(false);
    setDragOffset({ x: 0, y: 0 }); // Reset drag offset
  }, []);

  // Pan functionality - only start panning if not clicking on a site or cloud
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if click target is the SVG itself (background) and not a site/cloud element
    if (e.button === 0 && !isDragging && !isDraggingCloud && e.target === svgRef.current) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX - svgRef.current!.getBoundingClientRect().left, y: e.clientY - svgRef.current!.getBoundingClientRect().top });
    }
  }, [isDragging, isDraggingCloud]);

  // Zoom functionality
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const zoomFactor = direction === 'in' ? 1.2 : 1 / 1.2;
    const newZoom = Math.max(0.5, Math.min(3, zoom * zoomFactor));
    setZoom(newZoom);
  }, [zoom]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Handle site editing
  const handleEditSite = useCallback((site: Site) => {
    setEditingSite(site);
  }, []);

  const handleSaveSite = useCallback((siteId: string, updates: Partial<Site>) => {
    if (onUpdateSite) {
      onUpdateSite(siteId, updates);
      setHasUnsavedChanges(true);
    }
  }, [onUpdateSite]);

  const handleDeleteSite = useCallback((siteId: string) => {
    if (onDeleteSite) {
      onDeleteSite(siteId);
      setHasUnsavedChanges(true);
    }
  }, [onDeleteSite]);

  const handleSaveDesign = useCallback(() => {
    if (onSaveDesign) {
      onSaveDesign();
      setHasUnsavedChanges(false);
      setShowSaveIndicator(true);
      setTimeout(() => setShowSaveIndicator(false), 2000);
    }
  }, [onSaveDesign]);

  // Double-click to edit site
  const handleSiteDoubleClick = useCallback((site: Site) => {
    handleEditSite(site);
  }, [handleEditSite]);

  // Handle WAN cloud editing
  const handleEditWANCloud = useCallback((cloud: WANCloud) => {
    setEditingWANCloud(cloud);
  }, []);

  const handleSaveWANCloud = useCallback((cloudId: string, updates: Partial<WANCloud>) => {
    if (onUpdateWANCloud) {
      onUpdateWANCloud(cloudId, updates);
      setHasUnsavedChanges(true);
    }
  }, [onUpdateWANCloud]);

  const handleDeleteWANCloud = useCallback((cloudId: string) => {
    if (onDeleteWANCloud) {
      onDeleteWANCloud(cloudId);
      setHasUnsavedChanges(true);
    }
  }, [onDeleteWANCloud]);

  const handleHideWANCloud = useCallback((cloudId: string) => {
    setHiddenClouds(prev => {
      const newSet = new Set(prev);
      newSet.add(cloudId);
      return newSet;
    });
    setHasUnsavedChanges(true);
  }, []);

  const handleWANCloudClick = useCallback((cloud: WANCloud) => {
    // If a site is selected and user clicks a WAN cloud, offer to add connection
    if (selectedSite && onAddConnection) {
      const connectionType = cloud.type.toLowerCase();
      onAddConnection(selectedSite.id, connectionType);
    }
  }, [selectedSite, onAddConnection]);

  // Double-click to edit WAN cloud
  const handleWANCloudDoubleClick = useCallback((cloud: WANCloud) => {
    handleEditWANCloud(cloud);
  }, [handleEditWANCloud]);

  // Get active clouds (show clouds that have connections OR are custom added clouds, and aren't hidden)
  const getActiveClouds = (): WANCloud[] => {
    const usedCloudTypes = new Set<string>();
    
    sites.forEach(site => {
      site.connections.forEach(connection => {
        const cloud = getTargetCloud(connection);
        if (cloud) usedCloudTypes.add(cloud.type);
      });
    });

    return wanClouds.filter(cloud => {
      // Always show custom clouds (not hidden), or base clouds that have connections
      const isCustomCloud = customClouds.some(c => c.id === cloud.id);
      const hasConnections = usedCloudTypes.has(cloud.type);
      const isNotHidden = !hiddenClouds.has(cloud.id);
      
      return isNotHidden && (isCustomCloud || hasConnections);
    });
  };

  // Render connection lines
  const renderConnections = () => {
    const connections: React.ReactElement[] = [];
    const activeClouds = getActiveClouds();

    // Group MPLS sites for mesh connectivity
    const mplsSites = sites.filter(site => 
      site.connections.some(conn => conn.type.toLowerCase().includes('mpls'))
    );

    // Render MPLS mesh connections (site-to-site within MPLS network)
    if (connectionVisibility.mplsMesh && mplsSites.length > 1) {
      mplsSites.forEach((siteA, indexA) => {
        const posA = sitePositions[siteA.id];
        if (!posA) return;

        mplsSites.forEach((siteB, indexB) => {
          if (indexA >= indexB) return; // Avoid duplicate lines
          
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

    // Render site-to-cloud connections
    if (connectionVisibility.siteToCloud) {
      sites.forEach(site => {
        const sitePos = sitePositions[site.id];
        if (!sitePos) return;

        site.connections.forEach((connection, index) => {
          const targetCloud = getTargetCloud(connection);
          if (!targetCloud || !activeClouds.find(c => c.id === targetCloud.id)) return;
          
          // Check if this specific cloud is visible
          if (!cloudVisibility[targetCloud.id]) return;

          const cloudCenterX = targetCloud.x * dimensions.width;
          const cloudCenterY = targetCloud.y * dimensions.height;

          // Calculate connection point at edge of cloud (different radius for different types)
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

          // Add bandwidth label
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

  // Render WAN clouds
  const renderClouds = () => {
    return getActiveClouds().map(cloud => {
      if (hiddenClouds.has(cloud.id) || !cloudVisibility[cloud.id]) return null;
      const x = cloud.x * dimensions.width;
      const y = cloud.y * dimensions.height;
      
      // Different sizes for different cloud types
      const radius = (cloud.type === 'Internet' || cloud.type === 'MPLS') ? 60 : 45;
      const iconSize = (cloud.type === 'Internet' || cloud.type === 'MPLS') ? 28 : 20;

      return (
        <g 
          key={cloud.id}
          style={{ cursor: isDraggingCloud === cloud.id ? 'grabbing' : 'grab' }}
          onDoubleClick={() => handleWANCloudDoubleClick(cloud)}
          onClick={() => handleWANCloudClick(cloud)}
          onMouseDown={handleCloudMouseDown(cloud.id)}
        >
          {/* Cloud shape */}
          <circle
            cx={x}
            cy={y}
            r={radius}
            fill={cloud.color}
            fillOpacity="0.15"
            stroke={cloud.color}
            strokeWidth={cloud.type === 'Internet' || cloud.type === 'MPLS' ? "3" : "2"}
          />
          
          {/* Cloud icon */}
          <foreignObject
            x={x - iconSize/2}
            y={y - iconSize/2}
            width={iconSize}
            height={iconSize}
            style={{ pointerEvents: 'none' }}
          >
            <Cloud className={`w-full h-full`} color={cloud.color} />
          </foreignObject>
          
          {/* Edit indicator */}
          <circle
            cx={x + radius - 15}
            cy={y - radius + 15}
            r="8"
            fill="white"
            stroke={cloud.color}
            strokeWidth="1"
            opacity="0.9"
          />
          <foreignObject
            x={x + radius - 19}
            y={y - radius + 11}
            width="8"
            height="8"
            style={{ pointerEvents: 'none' }}
          >
            <Settings className="w-2 h-2" color={cloud.color} />
          </foreignObject>
          
          {/* Cloud label */}
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
          
          {/* Hub indicator for primary WANs */}
          {(cloud.type === 'Internet' || cloud.type === 'MPLS') && (
            <text
              x={x}
              y={y - radius - 8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="500"
              fill={cloud.color}
              opacity="0.8"
            >
              PRIMARY HUB
            </text>
          )}
        </g>
      );
    });
  };

  // Render sites
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
          onDoubleClick={() => handleSiteDoubleClick(site)}
        >
          {/* Site background */}
          <circle
            cx={position.x}
            cy={position.y}
            r={isSelected ? "25" : "20"}
            fill={siteColor}
            stroke={isSelected ? "#000" : "white"}
            strokeWidth={isSelected ? "3" : "2"}
            opacity={isHovered || isSelected ? 1 : 0.8}
          />
          
          {/* Site icon */}
          <foreignObject
            x={position.x - 10}
            y={position.y - 10}
            width="20"
            height="20"
            style={{ pointerEvents: 'none' }}
          >
            <IconComponent className="w-5 h-5 text-white" />
          </foreignObject>
          
          {/* Site label */}
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
          
          {/* Category label */}
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
          
          {/* Add connection button when site is selected */}
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
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
          onMouseDown={handleCanvasMouseDown}
        >
          {/* Render in layers: connections first, then clouds, then sites */}
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
                onClick={handleSaveDesign}
                className={hasUnsavedChanges ? "bg-orange-500 hover:bg-orange-600" : ""}
                data-testid="button-save-design"
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

        {/* Edit Site Button */}
        {selectedSite && onUpdateSite && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditSite(selectedSite)}
              data-testid="button-edit-selected-site"
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Edit Site
            </Button>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">View Controls</span>
              <Settings className="h-3 w-3 text-gray-500" />
            </div>
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleZoom('in')}
                className="px-2 py-1 text-xs"
                data-testid="button-zoom-in"
              >
                +
              </Button>
              <span className="text-xs text-gray-600 px-2">{Math.round(zoom * 100)}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleZoom('out')}
                className="px-2 py-1 text-xs"
                data-testid="button-zoom-out"
              >
                -
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetView}
              className="w-full text-xs"
              data-testid="button-reset-view"
            >
              Reset View
            </Button>
          </div>
        </div>

        {/* Connection Visibility Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Connection Lines</span>
              <Settings className="h-3 w-3 text-gray-500" />
            </div>
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
                  data-testid="checkbox-site-to-cloud"
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
                  data-testid="checkbox-mpls-mesh"
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
                  data-testid="checkbox-bandwidth-labels"
                />
                <span>Bandwidth Labels</span>
              </label>
              
              {/* Individual Cloud Connection Toggles */}
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
                      data-testid={`checkbox-cloud-${cloud.id}`}
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

        {/* Add WAN Cloud Button */}
        {onAddWANCloud && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
            <Button
              size="sm"
              onClick={() => setShowAddCloudDialog(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              data-testid="button-add-wan-cloud"
            >
              <Cloud className="h-4 w-4 mr-1" />
              Add WAN Cloud
            </Button>
          </div>
        )}

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
            <p className="text-xs text-gray-600">• Double-click sites/clouds to edit</p>
            <p className="text-xs text-gray-600">• Drag sites to reposition</p>
            <p className="text-xs text-gray-600">• MPLS creates mesh connectivity</p>
          </div>
        </div>
      </div>

      {/* Site Edit Dialog */}
      {editingSite && (
        <SiteEditDialog
          site={editingSite}
          open={!!editingSite}
          onClose={() => setEditingSite(null)}
          onSave={handleSaveSite}
          onDelete={onDeleteSite ? handleDeleteSite : undefined}
        />
      )}

      {/* WAN Cloud Edit Dialog */}
      {editingWANCloud && (
        <WANCloudEditDialog
          cloud={editingWANCloud}
          open={!!editingWANCloud}
          onClose={() => setEditingWANCloud(null)}
          onSave={handleSaveWANCloud}
          onDelete={onDeleteWANCloud ? handleDeleteWANCloud : undefined}
          onHide={handleHideWANCloud}
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
    </div>
  );
}