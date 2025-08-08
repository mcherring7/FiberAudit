import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Server, Database, Cloud } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  category: 'Corporate' | 'Branch' | 'Data Center' | 'Cloud';
  coordinates?: { x: number; y: number };
  connections: Array<{
    type: string;
    bandwidth: string;
    provider: string;
  }>;
}

interface NetworkTopologyProps {
  sites: Site[];
  onUpdateSiteCoordinates: (siteId: string, coordinates: { x: number; y: number }) => void;
}

export function NetworkTopology({ sites, onUpdateSiteCoordinates }: NetworkTopologyProps) {
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [sitePositions, setSitePositions] = useState<Record<string, {x: number, y: number}>>({});
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);

  // Initialize site positions
  useEffect(() => {
    const positions: Record<string, {x: number, y: number}> = {};
    
    sites.forEach((site, index) => {
      if (site.coordinates) {
        positions[site.id] = site.coordinates;
      } else {
        // Simple circular arrangement
        const angle = (index / sites.length) * 2 * Math.PI;
        const radius = 200;
        const centerX = 400;
        const centerY = 300;
        
        positions[site.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };
      }
    });
    
    setSitePositions(positions);
  }, [sites]);

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

  const handleMouseDown = (siteId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(siteId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Constrain to canvas bounds
    const constrainedX = Math.max(30, Math.min(rect.width - 30, x));
    const constrainedY = Math.max(30, Math.min(rect.height - 30, y));
    
    setSitePositions(prev => ({
      ...prev,
      [isDragging]: { x: constrainedX, y: constrainedY }
    }));
    
    // Update parent with normalized coordinates
    onUpdateSiteCoordinates(isDragging, {
      x: constrainedX / rect.width,
      y: constrainedY / rect.height
    });
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  // WAN cloud positions (fixed positions in the center)
  const wanClouds = [
    { id: 'internet', name: 'Internet', x: 200, y: 150, color: '#3b82f6' },
    { id: 'mpls', name: 'MPLS', x: 600, y: 150, color: '#8b5cf6' },
    { id: 'cloud', name: 'Cloud', x: 400, y: 450, color: '#06b6d4' },
  ];

  // Render connection lines
  const renderConnections = () => {
    const connections: React.ReactElement[] = [];
    
    sites.forEach(site => {
      const sitePos = sitePositions[site.id];
      if (!sitePos) return;

      site.connections.forEach((connection, index) => {
        // Simple mapping to clouds
        let targetCloud = wanClouds[0]; // Default to internet
        if (connection.type.includes('MPLS')) targetCloud = wanClouds[1];
        if (connection.type.includes('Cloud') || connection.type.includes('AWS')) targetCloud = wanClouds[2];

        const connectionId = `${site.id}-${index}`;
        
        connections.push(
          <line
            key={connectionId}
            x1={sitePos.x}
            y1={sitePos.y}
            x2={targetCloud.x}
            y2={targetCloud.y}
            stroke={targetCloud.color}
            strokeWidth="2"
            opacity={hoveredSite === site.id ? 1 : 0.6}
          />
        );
      });
    });

    return connections;
  };

  return (
    <div className="w-full h-full relative">
      <svg
        ref={canvasRef}
        width="100%"
        height="100%"
        className="border border-gray-200 rounded-lg bg-gray-50"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Render connections first (behind sites) */}
        {renderConnections()}

        {/* Render WAN clouds */}
        {wanClouds.map(cloud => (
          <g key={cloud.id}>
            <circle
              cx={cloud.x}
              cy={cloud.y}
              r="40"
              fill={cloud.color}
              opacity="0.3"
              stroke={cloud.color}
              strokeWidth="2"
            />
            <text
              x={cloud.x}
              y={cloud.y + 5}
              textAnchor="middle"
              className="text-sm font-medium fill-gray-700"
            >
              {cloud.name}
            </text>
          </g>
        ))}

        {/* Render sites */}
        {sites.map(site => {
          const position = sitePositions[site.id];
          if (!position) return null;

          const IconComponent = getSiteIcon(site.category);
          const siteColor = getSiteColor(site.category);
          
          return (
            <g
              key={site.id}
              style={{ cursor: isDragging === site.id ? 'grabbing' : 'grab' }}
              onMouseDown={handleMouseDown(site.id)}
              onMouseEnter={() => setHoveredSite(site.id)}
              onMouseLeave={() => setHoveredSite(null)}
            >
              {/* Site background */}
              <circle
                cx={position.x}
                cy={position.y}
                r="20"
                fill={siteColor}
                stroke="white"
                strokeWidth="2"
                opacity={hoveredSite === site.id ? 1 : 0.8}
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
                y={position.y + 35}
                textAnchor="middle"
                className="text-xs font-medium fill-gray-700"
                style={{ pointerEvents: 'none' }}
              >
                {site.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Network Types</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-0.5" style={{ backgroundColor: '#3b82f6' }}></div>
            <span>Internet</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-0.5" style={{ backgroundColor: '#8b5cf6' }}></div>
            <span>MPLS</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-0.5" style={{ backgroundColor: '#06b6d4' }}></div>
            <span>Cloud</span>
          </div>
        </div>
      </div>
    </div>
  );
}