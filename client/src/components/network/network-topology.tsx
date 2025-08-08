import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, Globe, Network, Wifi, Building2, Server, Database, Zap, Plus, Edit3 } from "lucide-react";

interface Site {
  id: string;
  name: string;
  location: string;
  category: "Branch" | "Corporate" | "Data Center" | "Cloud";
  connections: Connection[];
  coordinates: { x: number; y: number };
}

interface Connection {
  type: string;
  bandwidth: string;
  provider?: string;
  pointToPointEndpoint?: string;
  customProvider?: string;
}

interface WANCloud {
  id: string;
  type: 'Internet' | 'MPLS' | 'VPLS' | 'SD-WAN' | 'NaaS' | 'Private Cloud';
  name: string;
  x: number;
  y: number;
  connectedSites: string[];
  description: string;
  color: string;
  icon: React.ComponentType;
}

interface NetworkTopologyProps {
  sites: Site[];
  selectedSite: Site | null;
  onSelectSite: (site: Site | null) => void;
  onUpdateSiteCoordinates: (siteId: string, coordinates: { x: number; y: number }) => void;
  onAddSite?: () => void;
  onEditSite?: (site: Site) => void;
}

const NetworkTopology = ({ 
  sites, 
  selectedSite, 
  onSelectSite,
  onUpdateSiteCoordinates,
  onAddSite,
  onEditSite
}: NetworkTopologyProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [hoveredCloud, setHoveredCloud] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [sitePositions, setSitePositions] = useState<Record<string, {x: number, y: number}>>({});

  // WAN Clouds Configuration - based on Megaport's 13 multicloud scenarios and hybrid backbone architecture
  const wanClouds: WANCloud[] = [
    {
      id: 'internet-wan',
      type: 'Internet',
      name: 'Internet WAN',
      x: 0.2,
      y: 0.2,
      connectedSites: ['circuit-1', 'circuit-5'], // DIA connections
      description: 'Diverse DIA (Dedicated Internet Access) providing connectivity to regional Megaport hubs with consistent performance',
      color: 'bg-blue-500',
      icon: Cloud
    },
    {
      id: 'megaport-backbone',
      type: 'NaaS',
      name: 'Megaport Private Backbone',
      x: 0.5,
      y: 0.3,
      connectedSites: ['circuit-4'], // Megaport NaaS connections
      description: 'Software-defined private backbone enabling efficient tunneling and reducing MPLS expenses through Megaport hub architecture',
      color: 'bg-orange-500',
      icon: Cloud
    },
    {
      id: 'private-cloud-wan',
      type: 'Private Cloud',
      name: 'Private Cloud WAN',
      x: 0.8,
      y: 0.2,
      connectedSites: ['circuit-4'], // AWS Direct Connect, Azure ExpressRoute via Megaport
      description: 'Private connections to AWS Direct Connect, Azure ExpressRoute through Megaport hubs and data centers with Layer 2 P2P options',
      color: 'bg-cyan-500',
      icon: Cloud
    },
    {
      id: 'mpls-wan',
      type: 'MPLS',
      name: 'Legacy MPLS WAN',
      x: 0.2,
      y: 0.7,
      connectedSites: ['circuit-2'], // Traditional MPLS (being phased out)
      description: 'Traditional Verizon MPLS network - being replaced by Megaport backbone for cost efficiency and better cloud connectivity',
      color: 'bg-purple-500',
      icon: Cloud
    },
    {
      id: 'vpls-wan',
      type: 'VPLS',
      name: 'VPLS WAN',
      x: 0.8,
      y: 0.7,
      connectedSites: ['circuit-6'], // VPLS connections
      description: 'Virtual Private LAN Service with Layer 2 Point-to-Point connections through private backbone infrastructure',
      color: 'bg-green-500',
      icon: Cloud
    }
  ];

  // Enhanced site positioning with better spacing
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const positions: Record<string, {x: number, y: number}> = {};
    
    // Enhanced site positioning inspired by SD-WAN hub-and-spoke architecture
    const branchSites = sites.filter(s => s.category === 'Branch');
    const corporateSites = sites.filter(s => s.category === 'Corporate');
    const dataCenterSites = sites.filter(s => s.category === 'Data Center');
    const cloudSites = sites.filter(s => s.category === 'Cloud');

    // Position branches around the perimeter (like Comcast SD-WAN diagram)
    branchSites.forEach((site, index) => {
      const angle = (index / branchSites.length) * 2 * Math.PI;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
      const centerX = dimensions.width * 0.5;
      const centerY = dimensions.height * 0.5;
      
      positions[site.id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });

    // Position corporate HQ and data centers strategically
    corporateSites.forEach((site, index) => {
      positions[site.id] = {
        x: dimensions.width * 0.15,
        y: dimensions.height * (0.3 + index * 0.4)
      };
    });

    dataCenterSites.forEach((site, index) => {
      positions[site.id] = {
        x: dimensions.width * 0.85,
        y: dimensions.height * (0.3 + index * 0.4)
      };
    });

    // Position cloud services
    cloudSites.forEach((site, index) => {
      positions[site.id] = {
        x: dimensions.width * 0.8,
        y: dimensions.height * (0.15 + index * 0.1)
      };
    });

    // Only set positions for sites that don't already have custom positions
    Object.keys(positions).forEach(siteId => {
      if (!sitePositions[siteId]) {
        setSitePositions(prev => ({
          ...prev,
          [siteId]: positions[siteId]
        }));
      }
    });

  }, [sites, dimensions]);

  // Handle mouse events for dragging sites
  const handleMouseDown = (siteId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(siteId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSitePositions(prev => ({
      ...prev,
      [isDragging]: { x, y }
    }));
    
    // Update parent component with new coordinates
    onUpdateSiteCoordinates(isDragging, { x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  // Update canvas dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);

        if (width > 0 && height > 0 && (width !== dimensions.width || height !== dimensions.height)) {
          setDimensions({ width, height });
        }
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    const timeoutIds = [50, 100, 200, 300, 500].map(delay => 
      setTimeout(updateDimensions, delay)
    );

    return () => {
      window.removeEventListener("resize", updateDimensions);
      timeoutIds.forEach(clearTimeout);
    };
  }, [dimensions.width, dimensions.height]);

  const handleSiteDrag = (siteId: string, newX: number, newY: number) => {
    const boundedX = Math.max(20, Math.min(newX, dimensions.width - 20));
    const boundedY = Math.max(20, Math.min(newY, dimensions.height - 20));
    
    setSitePositions(prev => ({
      ...prev,
      [siteId]: { x: boundedX, y: boundedY }
    }));

    // Update coordinates as percentages
    onUpdateSiteCoordinates(siteId, {
      x: boundedX / dimensions.width,
      y: boundedY / dimensions.height
    });
  };

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
      case 'Corporate': return 'bg-indigo-500';
      case 'Branch': return 'bg-blue-500';
      case 'Data Center': return 'bg-orange-500';
      case 'Cloud': return 'bg-cyan-500';
      default: return 'bg-gray-500';
    }
  };

  // Generate connections from sites to appropriate WAN clouds
  const renderConnections = () => {
    const connections: JSX.Element[] = [];
    
    sites.forEach(site => {
      // Use real-time position for dynamic line updates during dragging
      const sitePos = sitePositions[site.id];
      if (!sitePos) return;

      // Site positions are already in pixel coordinates from drag handler
      const sitePosPixels = {
        x: sitePos.x,
        y: sitePos.y
      };

      site.connections.forEach((connection, index) => {
        // Determine which WAN cloud this connection should go to
        let targetCloud: WANCloud | null = null;
        
        if (connection.type === 'Internet' || connection.type === 'internet' || 
            connection.type === 'Broadband' || connection.type === 'Dedicated Internet' || 
            connection.type === 'LTE' || connection.type === 'Satellite') {
          targetCloud = getActiveWANClouds().find(c => c.type === 'Internet') || null;
        } else if (connection.type === 'MPLS' || connection.type === 'mpls') {
          targetCloud = getActiveWANClouds().find(c => c.type === 'MPLS') || null;
        } else if (connection.type === 'VPLS' || connection.type === 'vpls') {
          targetCloud = getActiveWANClouds().find(c => c.type === 'VPLS') || null;
        } else if (connection.type === 'AWS Direct Connect' || connection.type === 'Azure ExpressRoute' || 
                   connection.type.includes('Direct Connect') || connection.type === 'aws') {
          targetCloud = getActiveWANClouds().find(c => c.type === 'Private Cloud') || null;
        } else if (connection.type.includes('SD-WAN') || connection.type === 'NaaS' || connection.type === 'Megaport') {
          // SD-WAN and Megaport NaaS connections route through private backbone
          targetCloud = getActiveWANClouds().find(c => c.type === 'NaaS') || null;
        }

        if (targetCloud) {
          // Calculate dynamic connection point on edge of cloud shape
          const cloudCenterX = targetCloud.x * dimensions.width;
          const cloudCenterY = targetCloud.y * dimensions.height;
          
          // Calculate angle from current site position to cloud center
          const angle = Math.atan2(cloudCenterY - sitePosPixels.y, cloudCenterX - sitePosPixels.x);
          
          // Connect to edge of cloud shape (radius ~50px for cloud bounds)
          const cloudPos = {
            x: cloudCenterX - Math.cos(angle) * 50,
            y: cloudCenterY - Math.sin(angle) * 50
          };

          const connectionId = `${site.id}-${targetCloud.id}-${index}`;
          
          connections.push(
            <motion.line
              key={connectionId}
              x1={sitePosPixels.x}
              y1={sitePosPixels.y}
              x2={cloudPos.x}
              y2={cloudPos.y}
              stroke={connection.type === 'MPLS' ? '#8b5cf6' : 
                     connection.type === 'VPLS' ? '#10b981' : '#3b82f6'}
              strokeWidth="2"
              strokeDasharray={connection.type === 'Internet' ? '5,5' : '0'}
              opacity={hoveredSite === site.id || hoveredCloud === targetCloud.id ? 1 : 0.6}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, delay: 0.5 }}
            />
          );

          // Add connection label at dynamic midpoint
          const midX = (sitePosPixels.x + cloudPos.x) / 2;
          const midY = (sitePosPixels.y + cloudPos.y) / 2;
          
          connections.push(
            <motion.g key={`label-${connectionId}`}>
              <rect
                x={midX - 25}
                y={midY - 8}
                width="50"
                height="16"
                fill="white"
                stroke="#e5e7eb"
                rx="3"
                opacity={hoveredSite === site.id ? 1 : 0.8}
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
            </motion.g>
          );
        }
      });
    });

    return connections;
  };

  // Cloud SVG path for authentic cloud shapes - properly centered
  const renderCloudShape = (x: number, y: number, scale: number = 1, fillColor: string, strokeColor: string) => {
    const cloudPath = `M ${x - 25*scale},${y} 
                      C ${x - 35*scale},${y} ${x - 35*scale},${y - 20*scale} ${x - 25*scale},${y - 20*scale}
                      C ${x - 30*scale},${y - 30*scale} ${x - 15*scale},${y - 30*scale} ${x - 10*scale},${y - 20*scale}
                      C ${x - 5*scale},${y - 30*scale} ${x + 10*scale},${y - 30*scale} ${x + 15*scale},${y - 20*scale}
                      C ${x + 25*scale},${y - 20*scale} ${x + 25*scale},${y} ${x + 15*scale},${y}
                      C ${x + 15*scale},${y + 10*scale} ${x - 25*scale},${y + 10*scale} ${x - 25*scale},${y} Z`;
    
    return (
      <path
        d={cloudPath}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="2"
        className="drop-shadow-lg"
      />
    );
  };

  // Filter WAN clouds to only show those with actual connections in inventory
  const getActiveWANClouds = () => {
    const connectionTypes = new Set<string>();
    
    sites.forEach(site => {
      site.connections.forEach(connection => {
        // Map various connection types to WAN cloud categories
        if (connection.type === 'Internet' || connection.type === 'internet' || 
            connection.type === 'Broadband' || connection.type === 'Dedicated Internet' || 
            connection.type === 'LTE' || connection.type === 'Satellite') {
          connectionTypes.add('Internet');
        } else if (connection.type === 'MPLS' || connection.type === 'mpls') {
          connectionTypes.add('MPLS');
        } else if (connection.type === 'VPLS' || connection.type === 'vpls') {
          connectionTypes.add('VPLS');
        } else if (connection.type === 'AWS Direct Connect' || connection.type === 'Azure ExpressRoute' || 
                   connection.type.includes('Direct Connect') || connection.type === 'aws') {
          connectionTypes.add('Private Cloud');
        } else if (connection.type.includes('SD-WAN') || connection.type === 'NaaS' || connection.type === 'Megaport') {
          connectionTypes.add('NaaS');
        }
      });
    });

    return wanClouds.filter(cloud => connectionTypes.has(cloud.type));
  };

  const renderWANClouds = () => {
    const activeClouds = getActiveWANClouds();
    return activeClouds.map(cloud => {
      const x = cloud.x * dimensions.width;
      const y = cloud.y * dimensions.height;
      const isHovered = hoveredCloud === cloud.id;
      
      // Color mapping for cloud fills
      const colorMap: Record<string, string> = {
        'bg-blue-500': '#3b82f6',
        'bg-cyan-500': '#06b6d4', 
        'bg-purple-500': '#8b5cf6',
        'bg-green-500': '#10b981'
      };
      
      const fillColor = isHovered ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.95)';
      const strokeColor = colorMap[cloud.color] || '#3b82f6';
      
      return (
        <motion.g
          key={cloud.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          onMouseEnter={() => setHoveredCloud(cloud.id)}
          onMouseLeave={() => setHoveredCloud(null)}
          style={{ cursor: 'pointer' }}
        >
          {/* Outer cloud shape - larger */}
          {renderCloudShape(x, y, 2.2, fillColor, strokeColor)}
          
          {/* Inner cloud shape for depth */}
          {renderCloudShape(x, y, 1.6, 'rgba(255, 255, 255, 0.8)', strokeColor)}
          
          {/* Cloud type label */}
          <text
            x={x}
            y={y + 5}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill={strokeColor}
          >
            {cloud.type}
          </text>
          
          {/* Cloud description label */}
          <text
            x={x}
            y={y + 45}
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill="#6b7280"
          >
            {cloud.name}
          </text>
          
          {/* Hover tooltip */}
          {hoveredCloud === cloud.id && (
            <motion.g
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <rect
                x={x - 100}
                y={y - 90}
                width="200"
                height="50"
                fill="white"
                stroke="#e5e7eb"
                rx="6"
                filter="drop-shadow(0 4px 6px -1px rgb(0 0 0 / 0.1))"
              />
              <text
                x={x}
                y={y - 70}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
                className="max-w-48"
              >
                {cloud.description.substring(0, 80)}...
              </text>
            </motion.g>
          )}
        </motion.g>
      );
    });
  };

  const renderSites = () => {
    return sites.map(site => {
      const position = sitePositions[site.id];
      if (!position) return null;

      const IconComponent = getSiteIcon(site.category);
      const isHovered = hoveredSite === site.id;
      const isSelected = selectedSite?.id === site.id;

      return (
        <motion.g
          key={site.id}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <motion.g
            drag
            dragConstraints={{ 
              left: 20, 
              right: dimensions.width - 20, 
              top: 20, 
              bottom: dimensions.height - 20 
            }}
            onDragStart={() => setIsDragging(site.id)}
            onDragEnd={() => setIsDragging(null)}
            onDrag={(_, info) => {
              handleSiteDrag(site.id, info.point.x, info.point.y);
            }}
            whileHover={{ scale: 1.1 }}
            whileDrag={{ scale: 1.15 }}
            onMouseEnter={() => setHoveredSite(site.id)}
            onMouseLeave={() => setHoveredSite(null)}
            onClick={() => onSelectSite(isSelected ? null : site)}
            style={{ cursor: isDragging === site.id ? 'grabbing' : 'grab' }}
          >
            {/* Site background circle */}
            <circle
              cx={position.x}
              cy={position.y}
              r="25"
              fill={isSelected ? '#fbbf24' : 'white'}
              stroke={getSiteColor(site.category).replace('bg-', '#')}
              strokeWidth={isSelected ? "3" : "2"}
              filter="drop-shadow(0 2px 4px rgb(0 0 0 / 0.1))"
            />
            
            {/* Site icon */}
            <foreignObject 
              x={position.x - 10} 
              y={position.y - 10} 
              width="20" 
              height="20"
            >
              <IconComponent 
                size={20} 
                className={getSiteColor(site.category).replace('bg-', 'text-')}
              />
            </foreignObject>
            
            {/* Site label */}
            <text
              x={position.x}
              y={position.y + 40}
              textAnchor="middle"
              fontSize="11"
              fontWeight="500"
              fill="#374151"
            >
              {site.name.length > 15 ? `${site.name.substring(0, 15)}...` : site.name}
            </text>
            
            {/* Connection count badge */}
            <circle
              cx={position.x + 18}
              cy={position.y - 18}
              r="8"
              fill="#ef4444"
              stroke="white"
              strokeWidth="2"
            />
            <text
              x={position.x + 18}
              y={position.y - 15}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="white"
            >
              {site.connections.length}
            </text>
          </motion.g>
        </motion.g>
      );
    });
  };

  if (dimensions.width === 0 || dimensions.height === 0) {
    return (
      <div 
        ref={canvasRef} 
        className="w-full h-full flex items-center justify-center text-gray-500"
      >
        Loading topology...
      </div>
    );
  }

  return (
    <div ref={canvasRef} className="w-full h-full relative bg-gray-50 rounded-lg overflow-hidden">
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-sm border z-10">
        <h3 className="font-semibold text-sm mb-2">Network Legend</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-blue-500"></div>
            <span>Internet WAN</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-purple-500"></div>
            <span>MPLS WAN</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-500"></div>
            <span>VPLS WAN</span>
          </div>
        </div>
      </div>

      {/* Future state indicator */}
      <div className="absolute top-4 right-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-2 rounded-lg shadow-sm text-xs z-10">
        <div className="flex items-center gap-1">
          <Zap size={14} />
          <span>Future: SD-WAN + NaaS Integration</span>
        </div>
      </div>

      <svg width={dimensions.width} height={dimensions.height} className="absolute inset-0">
        {/* Grid background */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Render connections */}
        {renderConnections()}
        
        {/* Render WAN clouds */}
        {renderWANClouds()}
        
        {/* Render sites */}
        {renderSites()}
      </svg>
    </div>
  );
};

export default NetworkTopology;