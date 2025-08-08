import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Building2, Server, Database, Cloud } from 'lucide-react';

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
  onUpdateSiteCoordinates 
}: TopologyViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [sitePositions, setSitePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // WAN cloud definitions positioned strategically
  const wanClouds: WANCloud[] = [
    { id: 'internet', type: 'Internet', name: 'Internet WAN', x: 0.2, y: 0.2, color: '#3b82f6' },
    { id: 'mpls', type: 'MPLS', name: 'MPLS WAN', x: 0.8, y: 0.2, color: '#8b5cf6' },
    { id: 'cloud-services', type: 'Cloud', name: 'Cloud Services', x: 0.5, y: 0.8, color: '#06b6d4' },
    { id: 'megaport', type: 'NaaS', name: 'Megaport Backbone', x: 0.5, y: 0.4, color: '#f97316' }
  ];

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
        // Default circular positioning
        const angle = (index / sites.length) * 2 * Math.PI;
        const radius = Math.min(dimensions.width, dimensions.height) * 0.3;
        const centerX = dimensions.width * 0.5;
        const centerY = dimensions.height * 0.5;
        
        positions[site.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };
      }
    });
    
    setSitePositions(positions);
  }, [sites, dimensions]);

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
    
    if (type.includes('internet') || type.includes('broadband') || type.includes('lte')) {
      return wanClouds.find(c => c.type === 'Internet') || null;
    }
    if (type.includes('mpls')) {
      return wanClouds.find(c => c.type === 'MPLS') || null;
    }
    if (type.includes('aws') || type.includes('azure') || type.includes('cloud')) {
      return wanClouds.find(c => c.type === 'Cloud') || null;
    }
    if (type.includes('megaport') || type.includes('sd-wan') || type.includes('naas')) {
      return wanClouds.find(c => c.type === 'NaaS') || null;
    }
    
    return wanClouds.find(c => c.type === 'Internet') || null; // Default
  };

  // Drag handlers
  const handleMouseDown = useCallback((siteId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(siteId);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Constrain to canvas boundaries
    const constrainedX = Math.max(30, Math.min(rect.width - 30, x));
    const constrainedY = Math.max(30, Math.min(rect.height - 30, y));

    // Update site position immediately for real-time feedback
    setSitePositions(prev => ({
      ...prev,
      [isDragging]: { x: constrainedX, y: constrainedY }
    }));

    // Update parent component with normalized coordinates
    onUpdateSiteCoordinates(isDragging, {
      x: constrainedX / rect.width,
      y: constrainedY / rect.height
    });
  }, [isDragging, onUpdateSiteCoordinates]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Get active clouds (only show clouds that have connections)
  const getActiveClouds = (): WANCloud[] => {
    const usedCloudTypes = new Set<string>();
    
    sites.forEach(site => {
      site.connections.forEach(connection => {
        const cloud = getTargetCloud(connection);
        if (cloud) usedCloudTypes.add(cloud.type);
      });
    });

    return wanClouds.filter(cloud => usedCloudTypes.has(cloud.type));
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
    if (mplsSites.length > 1) {
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
    sites.forEach(site => {
      const sitePos = sitePositions[site.id];
      if (!sitePos) return;

      site.connections.forEach((connection, index) => {
        const targetCloud = getTargetCloud(connection);
        if (!targetCloud || !activeClouds.find(c => c.id === targetCloud.id)) return;

        const cloudCenterX = targetCloud.x * dimensions.width;
        const cloudCenterY = targetCloud.y * dimensions.height;

        // Calculate connection point at edge of cloud (50px radius)
        const angle = Math.atan2(cloudCenterY - sitePos.y, cloudCenterX - sitePos.x);
        const cloudEdgeX = cloudCenterX - Math.cos(angle) * 50;
        const cloudEdgeY = cloudCenterY - Math.sin(angle) * 50;

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
      });
    });

    return connections;
  };

  // Render WAN clouds
  const renderClouds = () => {
    const activeClouds = getActiveClouds();
    
    return activeClouds.map(cloud => {
      const x = cloud.x * dimensions.width;
      const y = cloud.y * dimensions.height;

      return (
        <g key={cloud.id}>
          {/* Cloud shape */}
          <circle
            cx={x}
            cy={y}
            r="50"
            fill={cloud.color}
            fillOpacity="0.2"
            stroke={cloud.color}
            strokeWidth="2"
          />
          <Cloud
            x={x - 12}
            y={y - 12}
            width="24"
            height="24"
            color={cloud.color}
          />
          
          {/* Cloud label */}
          <text
            x={x}
            y={y + 35}
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
        </g>
      );
    });
  };

  return (
    <div className="w-full h-full bg-gray-50 relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="border border-gray-200 rounded-lg"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Render in layers: connections first, then clouds, then sites */}
        {renderConnections()}
        {renderClouds()}
        {renderSites()}
      </svg>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200">
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
          <p className="text-xs text-gray-600">MPLS creates mesh connectivity between all sites</p>
          <p className="text-xs text-gray-600">Drag sites to reposition</p>
        </div>
      </div>
    </div>
  );
}