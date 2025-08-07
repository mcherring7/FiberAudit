import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

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
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [sitePositions, setSitePositions] = useState<Record<string, {x: number, y: number}>>({});

  // Update positions when sites or dimensions change
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const positions: Record<string, {x: number, y: number}> = {};
    sites.forEach(site => {
      positions[site.id] = {
        x: site.coordinates.x * dimensions.width,
        y: site.coordinates.y * dimensions.height
      };
    });
    setSitePositions(positions);
  }, [sites, dimensions]);

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
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [dimensions.width, dimensions.height]);

  const handleDragStart = (siteId: string) => {
    setIsDragging(siteId);
  };

  const handleDrag = (event: any, info: any, siteId: string) => {
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const padding = 40;
      const newX = Math.max(padding, Math.min(canvasRect.width - padding, info.point.x - canvasRect.left));
      const newY = Math.max(padding, Math.min(canvasRect.height - padding, info.point.y - canvasRect.top));

      setSitePositions(prev => ({
        ...prev,
        [siteId]: { x: newX, y: newY }
      }));
    }
  };

  const handleDragEnd = (event: any, info: any, siteId: string) => {
    setIsDragging(null);

    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const padding = 40;
      const newX = Math.max(padding, Math.min(canvasRect.width - padding, info.point.x - canvasRect.left));
      const newY = Math.max(padding, Math.min(canvasRect.height - padding, info.point.y - canvasRect.top));

      const relativeX = newX / dimensions.width;
      const relativeY = newY / dimensions.height;

      onUpdateSiteCoordinates(siteId, { 
        x: Math.max(0.05, Math.min(0.95, relativeX)),
        y: Math.max(0.05, Math.min(0.95, relativeY))
      });
    }
  };

  // Check which network elements should be displayed
  const hasInternet = sites.some(site => 
    site.connections.some(conn => 
      conn.type === 'internet' || conn.type === 'Internet' || 
      conn.type === 'broadband' || conn.type === 'dedicated'
    )
  );

  const hasMPLS = sites.some(site => 
    site.connections.some(conn => 
      conn.type === 'mpls' || conn.type === 'MPLS' || 
      conn.type === 'vpls' || conn.type === 'VPLS' ||
      conn.type === 'Private'
    )
  );

  const hasAWS = sites.some(site => 
    site.connections.some(conn => 
      conn.type === 'aws' || conn.provider?.toLowerCase().includes('aws') ||
      conn.provider?.toLowerCase().includes('amazon')
    )
  );

  const hasAzure = sites.some(site => 
    site.connections.some(conn => 
      conn.type === 'azure' || conn.provider?.toLowerCase().includes('azure') ||
      conn.provider?.toLowerCase().includes('microsoft')
    )
  );

  const hasGCP = sites.some(site => 
    site.connections.some(conn => 
      conn.type === 'gcp' || conn.provider?.toLowerCase().includes('google')
    )
  );

  // Get connection color based on type
  const getConnectionColor = (connectionType: string) => {
    switch (connectionType.toLowerCase()) {
      case 'internet': case 'broadband': case 'dedicated': return '#22C55E';
      case 'mpls': case 'vpls': case 'private': return '#3B82F6';
      case 'aws': return '#FF9500';
      case 'azure': return '#0078D4';
      case 'gcp': case 'google': return '#4285F4';
      case 'point-to-point': return '#8B5CF6';
      default: return '#64748B';
    }
  };

  // Get site icon and color based on category
  const getSiteStyle = (category: string) => {
    switch (category) {
      case 'Corporate': return { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', icon: '🏢' };
      case 'Data Center': return { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700', icon: '🏭' };
      case 'Cloud': return { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', icon: '☁️' };
      default: return { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700', icon: '🏪' };
    }
  };

  // Calculate connection paths
  const calculateConnectionPaths = () => {
    const paths: JSX.Element[] = [];

    sites.forEach((site) => {
      const sitePos = sitePositions[site.id];
      if (!sitePos) return;

      // Cloud centers
      const cloudCenters = {
        internet: { x: dimensions.width / 2, y: dimensions.height / 4 },
        mpls: { x: dimensions.width / 2, y: dimensions.height * 3/4 },
        aws: { x: dimensions.width - 120, y: dimensions.height / 4 },
        azure: { x: dimensions.width - 120, y: dimensions.height * 3/4 },
        gcp: { x: 120, y: dimensions.height / 4 }
      };

      site.connections.forEach((connection, idx) => {
        // Handle point-to-point connections
        if (connection.type === 'point-to-point' && connection.pointToPointEndpoint) {
          const targetSite = sites.find(s => s.name === connection.pointToPointEndpoint);
          if (targetSite && sitePositions[targetSite.id]) {
            const targetPos = sitePositions[targetSite.id];
            paths.push(
              <motion.line
                key={`${site.id}-p2p-${idx}`}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
                x1={sitePos.x}
                y1={sitePos.y}
                x2={targetPos.x}
                y2={targetPos.y}
                stroke={getConnectionColor(connection.type)}
                strokeWidth={selectedSite?.id === site.id || hoveredSite === site.id ? 3 : 2}
                strokeDasharray="10,5"
                strokeOpacity={selectedSite && selectedSite.id !== site.id ? 0.3 : 1}
              />
            );
          }
          return;
        }

        // Determine target center based on connection type
        let targetCenter = cloudCenters.internet;
        const connType = connection.type.toLowerCase();
        
        if (connType.includes('mpls') || connType.includes('vpls') || connType === 'private') {
          targetCenter = cloudCenters.mpls;
        } else if (connType.includes('aws') || connection.provider?.toLowerCase().includes('aws')) {
          targetCenter = cloudCenters.aws;
        } else if (connType.includes('azure') || connection.provider?.toLowerCase().includes('azure')) {
          targetCenter = cloudCenters.azure;
        } else if (connType.includes('gcp') || connection.provider?.toLowerCase().includes('google')) {
          targetCenter = cloudCenters.gcp;
        }

        // Create curved path
        const midX = (sitePos.x + targetCenter.x) / 2;
        const midY = (sitePos.y + targetCenter.y) / 2;
        
        const dx = targetCenter.x - sitePos.x;
        const dy = targetCenter.y - sitePos.y;
        const angle = Math.atan2(dy, dx);
        const normalAngle = angle + Math.PI/2;
        
        const controlPointOffset = 30;
        const controlX = midX + Math.cos(normalAngle) * controlPointOffset;
        const controlY = midY + Math.sin(normalAngle) * controlPointOffset;

        paths.push(
          <motion.path
            key={`${site.id}-connection-${idx}`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            d={`M ${sitePos.x} ${sitePos.y} Q ${controlX} ${controlY}, ${targetCenter.x} ${targetCenter.y}`}
            fill="none"
            stroke={getConnectionColor(connection.type)}
            strokeWidth={selectedSite?.id === site.id || hoveredSite === site.id ? 3 : 2}
            strokeDasharray={connType.includes('mpls') || connType.includes('vpls') ? "5,5" : undefined}
            strokeOpacity={selectedSite && selectedSite.id !== site.id ? 0.3 : 1}
          />
        );
      });
    });

    return paths;
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full bg-gray-50 overflow-hidden"
    >
      {/* SVG for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {calculateConnectionPaths()}
      </svg>

      {/* Internet Cloud */}
      {hasInternet && (
        <div
          className="absolute"
          style={{
            left: dimensions.width / 2 - 80,
            top: dimensions.height / 4 - 40,
            width: 160,
            height: 80,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="w-full h-full bg-white rounded-full shadow-md flex items-center justify-center border border-gray-200"
          >
            <div className="text-center">
              <span className="text-2xl">🌐</span>
              <p className="text-xs font-medium text-gray-600 mt-1">Internet</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* MPLS Cloud */}
      {hasMPLS && (
        <div
          className="absolute"
          style={{
            left: dimensions.width / 2 - 80,
            top: dimensions.height * 3/4 - 40,
            width: 160,
            height: 80,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="w-full h-full bg-white rounded-full shadow-md flex items-center justify-center border border-blue-200"
          >
            <div className="text-center">
              <span className="text-2xl">🔗</span>
              <p className="text-xs font-medium text-blue-600 mt-1">MPLS</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* AWS Cloud */}
      {hasAWS && (
        <div
          className="absolute"
          style={{
            right: 40,
            top: dimensions.height / 4 - 35,
            width: 140,
            height: 70,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            className="w-full h-full bg-white rounded-xl shadow-md flex items-center justify-center border border-orange-200"
          >
            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-1 bg-orange-100 rounded flex items-center justify-center">
                <span className="text-orange-600 font-bold text-xs">AWS</span>
              </div>
              <span className="text-xs font-medium text-orange-500">Amazon Web Services</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Azure Cloud */}
      {hasAzure && (
        <div
          className="absolute"
          style={{
            right: 40,
            top: dimensions.height * 3/4 - 35,
            width: 140,
            height: 70,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
            className="w-full h-full bg-white rounded-xl shadow-md flex items-center justify-center border border-blue-200"
          >
            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-1 bg-sky-100 rounded flex items-center justify-center">
                <span className="text-sky-600 font-bold text-xs">Az</span>
              </div>
              <span className="text-xs font-medium text-sky-500">Microsoft Azure</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* GCP Cloud */}
      {hasGCP && (
        <div
          className="absolute"
          style={{
            left: 40,
            top: dimensions.height / 4 - 35,
            width: 140,
            height: 70,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.4 }}
            className="w-full h-full bg-white rounded-xl shadow-md flex items-center justify-center border border-blue-200"
          >
            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-1 bg-blue-100 rounded flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xs">GCP</span>
              </div>
              <span className="text-xs font-medium text-blue-500">Google Cloud</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Sites */}
      {sites.map((site) => {
        const position = sitePositions[site.id];
        if (!position) return null;

        const style = getSiteStyle(site.category);
        const isSelected = selectedSite?.id === site.id;
        const isHovered = hoveredSite === site.id;

        return (
          <motion.div
            key={site.id}
            drag
            dragConstraints={canvasRef}
            onDragStart={() => handleDragStart(site.id)}
            onDrag={(event, info) => handleDrag(event, info, site.id)}
            onDragEnd={(event, info) => handleDragEnd(event, info, site.id)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: Math.random() * 0.3 }}
            className={`absolute cursor-pointer select-none ${
              isSelected ? 'z-20' : isHovered ? 'z-10' : 'z-0'
            }`}
            style={{
              left: position.x - 40,
              top: position.y - 40,
              width: 80,
              height: 80,
            }}
            onClick={() => onSelectSite(isSelected ? null : site)}
            onMouseEnter={() => setHoveredSite(site.id)}
            onMouseLeave={() => setHoveredSite(null)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <div
              className={`w-full h-full rounded-xl shadow-lg border-2 transition-all duration-200 ${
                style.bg
              } ${style.border} ${
                isSelected
                  ? 'ring-2 ring-primary ring-offset-2 shadow-xl'
                  : isHovered
                  ? 'shadow-xl transform scale-105'
                  : ''
              }`}
            >
              <div className="flex flex-col items-center justify-center h-full p-2">
                <span className="text-lg mb-1">{style.icon}</span>
                <span className={`text-xs font-medium text-center leading-tight ${style.text}`}>
                  {site.name}
                </span>
                <Badge 
                  variant="secondary" 
                  className="text-xs mt-1 px-1 py-0"
                >
                  {site.connections.length}
                </Badge>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default NetworkTopology;