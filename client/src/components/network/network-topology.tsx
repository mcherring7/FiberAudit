import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Cloud, Globe, Network, Wifi, Building2, Server, Database, Zap } from "lucide-react";

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
  type: 'Internet' | 'MPLS' | 'VPLS' | 'SD-WAN' | 'NaaS';
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
}

const NetworkTopology = ({ 
  sites, 
  selectedSite, 
  onSelectSite,
  onUpdateSiteCoordinates
}: NetworkTopologyProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [hoveredCloud, setHoveredCloud] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [sitePositions, setSitePositions] = useState<Record<string, {x: number, y: number}>>({});

  // WAN Clouds Configuration - centered in the middle based on SD-WAN architecture patterns
  const wanClouds: WANCloud[] = [
    {
      id: 'internet-wan',
      type: 'Internet',
      name: 'Internet WAN',
      x: 0.5,
      y: 0.2,
      connectedSites: ['circuit-1', 'circuit-5'], // Internet connections
      description: 'Public Internet connectivity for cost-effective access to cloud services and general traffic (49% of enterprise sites)',
      color: 'bg-blue-500',
      icon: Globe
    },
    {
      id: 'mpls-wan',
      type: 'MPLS',
      name: 'MPLS WAN',
      x: 0.5,
      y: 0.5,
      connectedSites: ['circuit-2'], // MPLS connections
      description: 'Traditional MPLS network providing guaranteed SLA and QoS for critical business applications (41% of enterprise sites)',
      color: 'bg-purple-500',
      icon: Network
    },
    {
      id: 'vpls-wan',
      type: 'VPLS',
      name: 'VPLS WAN',
      x: 0.5,
      y: 0.8,
      connectedSites: ['circuit-6'], // VPLS connections
      description: 'Virtual Private LAN Service enabling multipoint Layer 2 connectivity across locations',
      color: 'bg-green-500',
      icon: Wifi
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
    
    setSitePositions(positions);
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
      const sitePos = sitePositions[site.id];
      if (!sitePos) return;

      site.connections.forEach((connection, index) => {
        // Determine which WAN cloud this connection should go to
        let targetCloud: WANCloud | null = null;
        
        if (connection.type === 'Internet') {
          targetCloud = wanClouds.find(c => c.type === 'Internet') || null;
        } else if (connection.type === 'MPLS') {
          targetCloud = wanClouds.find(c => c.type === 'MPLS') || null;
        } else if (connection.type === 'VPLS') {
          targetCloud = wanClouds.find(c => c.type === 'VPLS') || null;
        } else if (connection.type.includes('SD-WAN') || connection.type === 'NaaS') {
          // Future SD-WAN connections can be added here
          return;
        }

        if (targetCloud) {
          const cloudPos = {
            x: targetCloud.x * dimensions.width,
            y: targetCloud.y * dimensions.height
          };

          const connectionId = `${site.id}-${targetCloud.id}-${index}`;
          
          connections.push(
            <motion.line
              key={connectionId}
              x1={sitePos.x}
              y1={sitePos.y}
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

          // Add connection label
          const midX = (sitePos.x + cloudPos.x) / 2;
          const midY = (sitePos.y + cloudPos.y) / 2;
          
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

  const renderWANClouds = () => {
    return wanClouds.map(cloud => {
      const IconComponent = cloud.icon;
      const x = cloud.x * dimensions.width;
      const y = cloud.y * dimensions.height;
      
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
          {/* Cloud background */}
          <circle
            cx={x}
            cy={y}
            r="50"
            fill={cloud.color.replace('bg-', 'rgb(') + ')'}
            fillOpacity={hoveredCloud === cloud.id ? 0.3 : 0.2}
            stroke={cloud.color.replace('bg-', 'rgb(') + ')'}
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Cloud icon */}
          <foreignObject x={x - 12} y={y - 12} width="24" height="24">
            <IconComponent 
              size={24} 
              className={`${cloud.color.replace('bg-', 'text-')} drop-shadow-md`}
            />
          </foreignObject>
          
          {/* Cloud label */}
          <text
            x={x}
            y={y + 35}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#374151"
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