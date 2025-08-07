import { useRef, useEffect, useState } from "react";
import { Site } from "@/types/site";
import { motion, AnimatePresence } from "framer-motion";
import { getCategoryColor, getConnectionColor, getProviderColor } from "@/utils/siteColors";
import { NetworkElement } from "@/types/topology";

interface NetworkTopologyProps {
  sites: Site[];
  selectedSite: Site | null;
  onSelectSite: (site: Site | null) => void;
  onUpdateSiteCoordinates: (siteId: string, coordinates: { x: number; y: number }) => void;
  networkElements?: NetworkElement[];
}

const NetworkTopology = ({ 
  sites, 
  selectedSite, 
  onSelectSite,
  onUpdateSiteCoordinates,
  networkElements = []
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
      // Calculate position based on relative coordinates
      positions[site.id] = {
        x: site.coordinates.x * dimensions.width,
        y: site.coordinates.y * dimensions.height
      };
    });
    setSitePositions(positions);
  }, [sites, dimensions]);

  // Update canvas dimensions with improved detection
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);

        if (width > 0 && height > 0 && (width !== dimensions.width || height !== dimensions.height)) {
          setDimensions({
            width,
            height,
          });
        }
      }
    };

    updateDimensions();

    window.addEventListener("resize", updateDimensions);

    // Check dimensions multiple times to ensure we have the correct values
    // with more frequent checks at the beginning
    const timeoutIds = [50, 100, 200, 300, 500, 800, 1200].map(delay => 
      setTimeout(updateDimensions, delay)
    );

    // Also recheck when visibility state changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(updateDimensions, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, []);

  const handleDragStart = (siteId: string) => {
    setIsDragging(siteId);
  };

  const handleDrag = (event: any, info: any, siteId: string) => {
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();

      // Add padding to prevent sites from being too close to the edge
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

      // Add padding to prevent sites from being too close to the edge
      const padding = 40;
      const newX = Math.max(padding, Math.min(canvasRect.width - padding, info.point.x - canvasRect.left));
      const newY = Math.max(padding, Math.min(canvasRect.height - padding, info.point.y - canvasRect.top));

      // Convert to relative coordinates (with padding consideration)
      const relativeX = newX / dimensions.width;
      const relativeY = newY / dimensions.height;

      onUpdateSiteCoordinates(siteId, { 
        x: Math.max(0.05, Math.min(0.95, relativeX)),
        y: Math.max(0.05, Math.min(0.95, relativeY))
      });
    }
  };

  // Check which network elements should be displayed based on site connections
  const hasInternet = (networkElements && networkElements.some(el => el.type === 'internet' && el.enabled)) || 
                     sites.some(site => (site.connections || []).some(conn => conn.type === 'internet'));

  const hasMPLS = (networkElements && networkElements.some(el => el.type === 'mpls' && el.enabled)) ||
                sites.some(site => (site.connections || []).some(conn => 
                  conn.type === 'mpls' || conn.type === 'vpls'
                ));

  const hasAWS = (networkElements && networkElements.some(el => el.type === 'aws' && el.enabled)) ||
                sites.some(site => (site.connections || []).some(conn => 
                  conn.type === 'aws' || (conn.provider && conn.provider.toLowerCase().includes('aws'))
                ));

  const hasAzure = (networkElements && networkElements.some(el => el.type === 'azure' && el.enabled)) ||
                  sites.some(site => (site.connections || []).some(conn => 
                    conn.type === 'azure' || (conn.provider && conn.provider.toLowerCase().includes('azure'))
                  ));

  const hasGCP = (networkElements && networkElements.some(el => el.type === 'gcp' && el.enabled)) ||
                sites.some(site => (site.connections || []).some(conn => 
                  conn.type === 'gcp' || conn.type === 'google' || (conn.provider && conn.provider.toLowerCase().includes('google'))
                ));

  const hasOracle = (networkElements && networkElements.some(el => el.type === 'oracle' && el.enabled)) ||
                   sites.some(site => (site.connections || []).some(conn => 
                     conn.type === 'oracle' || (conn.provider && conn.provider.toLowerCase().includes('oracle'))
                   ));

  // Calculate connection paths between sites and clouds
  const calculateConnectionPaths = () => {
    const paths: JSX.Element[] = [];

    sites.forEach((site) => {
      const sitePos = sitePositions[site.id];

      if (!sitePos) return;

      // Cloud centers
      const cloudCenters = {
        internet: { x: dimensions.width / 2, y: dimensions.height / 3 },
        mpls: { x: dimensions.width / 2, y: dimensions.height * (2/3) },
        aws: { x: dimensions.width - (dimensions.width * 0.2) / 2 - 10, y: dimensions.height / 3 },
        azure: { x: dimensions.width - (dimensions.width * 0.2) / 2 - 10, y: dimensions.height * (2/3) },
        gcp: { x: (dimensions.width * 0.2) / 2 + 10, y: dimensions.height / 3 },
        oracle: { x: (dimensions.width * 0.2) / 2 + 10, y: dimensions.height * (2/3) }
      };

      (site.connections || []).forEach((connection, idx) => {
        // Handle point-to-point connections
        if (connection.type.toLowerCase().includes('point') || connection.pointToPointEndpoint) {
          const targetSite = sites.find(s => s.name === connection.pointToPointEndpoint || s.id === connection.pointToPointEndpoint);
          if (targetSite && sitePositions[targetSite.id]) {
            const targetPos = sitePositions[targetSite.id];
            const connectionColor = connection.customProvider 
              ? getProviderColor(connection.customProvider) 
              : (connection.provider ? getProviderColor(connection.provider) : '#8B5CF6');

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
                stroke={connectionColor}
                strokeWidth={selectedSite?.id === site.id || hoveredSite === site.id ? 3 : 2}
                strokeDasharray="10,5"
                strokeOpacity={selectedSite && selectedSite.id !== site.id ? 0.3 : 1}
              />
            );
          }
          return;
        }

        // Determine target center based on connection type
        let targetCenter;
        const connType = connection.type.toLowerCase();
        if (connType.includes('mpls') || connType.includes('vpls')) {
          targetCenter = cloudCenters.mpls;
        } else if (connType.includes('aws') || connection.provider?.toLowerCase().includes('aws')) {
          targetCenter = cloudCenters.aws;
        } else if (connType.includes('azure') || connection.provider?.toLowerCase().includes('azure')) {
          targetCenter = cloudCenters.azure;
        } else if (connType.includes('gcp') || connType.includes('google') || connection.provider?.toLowerCase().includes('google')) {
          targetCenter = cloudCenters.gcp;
        } else if (connType.includes('oracle') || connection.provider?.toLowerCase().includes('oracle')) {
          targetCenter = cloudCenters.oracle;
        } else {
          targetCenter = cloudCenters.internet;
        }

        // Adjust offset angle based on number of connections
        const offsetAngle = (idx - ((site.connections || []).length - 1) / 2) * 0.15;
        const controlPointOffset = 30 + (idx * 10);

        // Calculate midpoint
        const midX = (sitePos.x + targetCenter.x) / 2;
        const midY = (sitePos.y + targetCenter.y) / 2;

        // Calculate direction vector
        const dx = targetCenter.x - sitePos.x;
        const dy = targetCenter.y - sitePos.y;

        // Calculate angle between site and cloud
        const angle = Math.atan2(dy, dx);

        // Calculate normal angle (perpendicular to the direction)
        const normalAngle = angle + Math.PI/2;

        // Adjust control point offset based on which side of the cloud the site is on
        // Sites on the left side need different curve direction
        const isLeftSide = sitePos.x < targetCenter.x;
        const adjustedOffsetAngle = isLeftSide ? offsetAngle : -offsetAngle;

        // Calculate control point with adjusted offset
        const controlX = midX + Math.cos(normalAngle + adjustedOffsetAngle) * controlPointOffset;
        const controlY = midY + Math.sin(normalAngle + adjustedOffsetAngle) * controlPointOffset;

        const connectionColor = connection.customProvider 
          ? getProviderColor(connection.customProvider)
          : (connection.provider 
            ? getProviderColor(connection.provider) 
            : getConnectionColor(connection.type));

        paths.push(
          <motion.path
            key={`${site.id}-connection-${idx}`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            d={`M ${sitePos.x} ${sitePos.y} Q ${controlX} ${controlY}, ${targetCenter.x} ${targetCenter.y}`}
            fill="none"
            stroke={connectionColor}
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
      {/* Internet Cloud */}
      <div
        className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        style={{
          width: dimensions.width * 0.25,
          height: dimensions.height * 0.25,
          minWidth: 120,
          minHeight: 80,
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full h-full bg-white rounded-full shadow-md flex items-center justify-center border border-gray-100"
        >
          <svg
            className="w-16 h-16 text-gray-300"
            fill="currentColor"
            viewBox="0 0 100 100"
          >
            <path d="M75,60 C85,60 90,50 85,40 C85,35 80,30 75,30 C70,25 60,25 55,30 C50,25 40,25 35,30 C30,30 25,35 25,40 C20,50 25,60 35,60 Z"/>
          </svg>
          <span className="absolute text-xs font-light text-gray-500 mt-12">Internet</span>
        </motion.div>
      </div>

      {/* MPLS Cloud */}
      {hasMPLS && (
        <div
          className="absolute bottom-1/3 left-1/2 transform -translate-x-1/2 translate-y-1/2"
          style={{
            width: dimensions.width * 0.25,
            height: dimensions.height * 0.25,
            minWidth: 120,
            minHeight: 80,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="w-full h-full bg-white rounded-full shadow-md flex items-center justify-center border border-blue-100"
          >
            <svg
              className="w-16 h-16 text-blue-200"
              fill="currentColor"
              viewBox="0 0 100 100"
            >
              <path d="M75,60 C85,60 90,50 85,40 C85,35 80,30 75,30 C70,25 60,25 55,30 C50,25 40,25 35,30 C30,30 25,35 25,40 C20,50 25,60 35,60 Z"/>
            </svg>
            <span className="absolute text-xs font-light text-blue-500 mt-12">MPLS</span>
          </motion.div>
        </div>
      )}

      {/* AWS Cloud */}
      {hasAWS && (
        <div
          className="absolute top-1/3 right-10"
          style={{
            width: dimensions.width * 0.2,
            height: dimensions.height * 0.2,
            minWidth: 100,
            minHeight: 70,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            className="w-full h-full bg-white rounded-xl shadow-md flex items-center justify-center border border-orange-100"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 font-bold text-sm">AWS</span>
              </div>
              <span className="text-xs font-light text-orange-500">Amazon Web Services</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Azure Cloud */}
      {hasAzure && (
        <div
          className="absolute bottom-1/3 right-10"
          style={{
            width: dimensions.width * 0.2,
            height: dimensions.height * 0.2,
            minWidth: 100,
            minHeight: 70,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
            className="w-full h-full bg-white rounded-xl shadow-md flex items-center justify-center border border-blue-100"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-sky-100 rounded-lg flex items-center justify-center">
                <span className="text-sky-600 font-bold text-sm">Az</span>
              </div>
              <span className="text-xs font-light text-sky-500">Microsoft Azure</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* GCP Cloud */}
      {hasGCP && (
        <div
          className="absolute top-1/3 left-10"
          style={{
            width: dimensions.width * 0.2,
            height: dimensions.height * 0.2,
            minWidth: 100,
            minHeight: 70,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.4 }}
            className="w-full h-full bg-white rounded-xl shadow-md flex items-center justify-center border border-green-100"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 font-bold text-sm">GCP</span>
              </div>
              <span className="text-xs font-light text-green-500">Google Cloud</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Oracle Cloud */}
      {hasOracle && (
        <div
          className="absolute bottom-1/3 left-10"
          style={{
            width: dimensions.width * 0.2,
            height: dimensions.height * 0.2,
            minWidth: 100,
            minHeight: 70,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
            className="w-full h-full bg-white rounded-xl shadow-md flex items-center justify-center border border-red-100"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600 font-bold text-sm">OCI</span>
              </div>
              <span className="text-xs font-light text-red-500">Oracle Cloud</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {calculateConnectionPaths()}
      </svg>

      {/* Site nodes */}
      {sites.map((site) => {
        const position = sitePositions[site.id] || { 
          x: site.coordinates.x * dimensions.width, 
          y: site.coordinates.y * dimensions.height 
        };

        const isSelected = selectedSite?.id === site.id;
        const isHovered = hoveredSite === site.id;
        const isDraggingThis = isDragging === site.id;

        const scaleFactor = Math.max(0.6, 1 - (sites.length / 60));
        const siteSize = {
          width: 50 * scaleFactor,
          height: 50 * scaleFactor
        };

        return (
          <motion.div
            key={site.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: isSelected || isHovered ? 1.1 : 1, 
              opacity: selectedSite && !isSelected ? 0.7 : 1,
              x: position.x,
              y: position.y,
              zIndex: isDraggingThis ? 50 : 10
            }}
            drag
            dragMomentum={false}
            dragElastic={0}
            onDragStart={() => handleDragStart(site.id)}
            onDrag={(event, info) => handleDrag(event, info, site.id)}
            onDragEnd={(event, info) => handleDragEnd(event, info, site.id)}
            whileDrag={{ scale: 1.1 }}
            transition={{ 
              type: "spring", 
              damping: 25,
              stiffness: 300,
              // Make x/y transitions smoother with specific settings
              x: { type: "spring", stiffness: 350, damping: 30 },
              y: { type: "spring", stiffness: 350, damping: 30 },
              // Make the scale transition smoother
              scale: { type: "spring", stiffness: 400, damping: 25 }
            }}
            className={`absolute cursor-pointer ${isDraggingThis ? 'z-50' : 'z-10'}`}
            style={{ 
              touchAction: "none",
              transform: "translate(-50%, -50%)",
            }}
            onClick={() => onSelectSite(isSelected ? null : site)}
            onMouseEnter={() => setHoveredSite(site.id)}
            onMouseLeave={() => setHoveredSite(null)}
          >
            <div 
              className={`rounded-full p-3 shadow-md transition-colors border ${
                isSelected ? "border-gray-400" : "border-gray-200"
              }`}
              style={{ 
                backgroundColor: "white",
                borderColor: getCategoryColor(site.category),
                borderWidth: "2px"
              }}
            >
              {(site.connections || []).length > 0 && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: site.connections[0].provider 
                    ? getProviderColor(site.connections[0].provider) 
                    : getConnectionColor(site.connections[0].type) 
                  }}
                />
              )}
            </div>

            <div 
              className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-1 whitespace-nowrap z-20`}
              style={{
                opacity: 1,
                pointerEvents: 'none'
              }}
            >
              <div className="bg-white px-2 py-1 rounded text-xs shadow-sm">
                {site.name}
              </div>
              <AnimatePresence>
                {(isSelected || isHovered || isDraggingThis) && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="bg-white mt-1 px-2 py-1 rounded text-xs shadow-sm"
                  >
                    <div className="flex items-center gap-1">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: getCategoryColor(site.category) }}
                      />
                      <span>{site.category} - {site.location}</span>
                    </div>
                    {(site.connections || []).map((connection, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: connection.customProvider 
                            ? getProviderColor(connection.customProvider)
                            : (connection.provider 
                              ? getProviderColor(connection.provider) 
                              : getConnectionColor(connection.type))
                          }}
                        />
                        <span>
                          {connection.type}: {connection.bandwidth}
                          {connection.pointToPointEndpoint && <span className="ml-1 text-purple-600"> → {connection.pointToPointEndpoint}</span>}
                          {(connection.customProvider || connection.provider) && (
                            <span className="ml-1 text-gray-500">({connection.customProvider || connection.provider})</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default NetworkTopology;