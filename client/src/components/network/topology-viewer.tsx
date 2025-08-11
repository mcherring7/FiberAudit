import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Building2, Server, Database, Cloud, Edit3, Save, AlertCircle, Settings, Zap, ZoomIn, ZoomOut, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  
  // Network optimization view state
  const [isOptimizationView, setIsOptimizationView] = useState(false);
  const [showOptimizationQuestionnaire, setShowOptimizationQuestionnaire] = useState(false);
  const [optimizationAnswers, setOptimizationAnswers] = useState<{
    primaryGoal: string;
    budget: string;
    redundancy: string;
    latency: string;
    compliance: string;
    timeline: string;
  } | null>(null);
  const [popDistanceThreshold, setPopDistanceThreshold] = useState(1500); // 500-2500 miles, acceptable distance for site-to-POP connections
  const [showHeatMap, setShowHeatMap] = useState(false);

  // Base WAN cloud definitions - positions will be overridden by cloudPositions state
  const baseWanClouds: WANCloud[] = [
    { id: 'internet', type: 'Internet', name: 'Internet WAN', x: 0.35, y: 0.5, color: '#3b82f6' },
    { id: 'mpls', type: 'MPLS', name: 'MPLS WAN', x: 0.65, y: 0.5, color: '#8b5cf6' },
    { id: 'azure-hub', type: 'Azure', name: 'Azure ExpressRoute', x: 0.8, y: 0.2, color: '#0078d4' },
    { id: 'megaport', type: 'NaaS', name: 'Megaport NaaS', x: 0.5, y: 0.8, color: '#f97316' }
  ];

  // Real Megaport POP locations with actual addresses  
  const [megaportPOPs, setMegaportPOPs] = useState([
    { 
      id: 'megapop-nyc', 
      name: 'New York', 
      address: '60 Hudson Street, New York, NY 10013',
      x: 0.85, y: 0.25, active: false 
    },
    { 
      id: 'megapop-chi', 
      name: 'Chicago', 
      address: '350 East Cermak Road, Chicago, IL 60616',
      x: 0.65, y: 0.35, active: false 
    },
    { 
      id: 'megapop-dal', 
      name: 'Dallas', 
      address: '2323 Bryan Street, Dallas, TX 75201',
      x: 0.55, y: 0.75, active: false 
    },
    { 
      id: 'megapop-lax', 
      name: 'Los Angeles', 
      address: '600 West 7th Street, Los Angeles, CA 90017',
      x: 0.15, y: 0.75, active: false 
    },
    { 
      id: 'megapop-sfo', 
      name: 'San Francisco', 
      address: '365 Main Street, San Francisco, CA 94105',
      x: 0.08, y: 0.35, active: false 
    },
    { 
      id: 'megapop-mia', 
      name: 'Miami', 
      address: '36 NE 2nd Street, Miami, FL 33132',
      x: 0.85, y: 0.95, active: false 
    },
    { 
      id: 'megapop-hou', 
      name: 'Houston', 
      address: '2626 Spring Cypress Road, Spring, TX 77388',
      x: 0.5, y: 0.8, active: false 
    },
    { 
      id: 'megapop-res', 
      name: 'Reston', 
      address: '12100 Sunrise Valley Drive, Reston, VA 20191',
      x: 0.82, y: 0.4, active: false 
    }
  ]);

  // Calculate distance between site and POP in miles
  const calculateDistance = useCallback((site: Site, pop: any) => {
    if (!site.coordinates) return Infinity;
    
    // Convert normalized coordinates to approximate miles
    // US is roughly 2,800 miles wide and 1,600 miles tall
    const dx = Math.abs(site.coordinates.x - pop.x) * 2800;
    const dy = Math.abs(site.coordinates.y - pop.y) * 1600;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);



  // Check if Data Center has Megaport onramp capability
  const hasDataCenterOnramp = useCallback((site: Site) => {
    if (site.category !== 'Data Center') return false;
    
    // Major metros with known Megaport presence
    const megaportMetros = ['new york', 'san francisco', 'chicago', 'dallas', 'atlanta', 'seattle', 'miami'];
    const isInMegaportMetro = megaportMetros.some(metro => 
      site.location.toLowerCase().includes(metro) || 
      site.name.toLowerCase().includes(metro)
    );
    
    // Any data center in a major metro can potentially be a Megaport onramp
    // This ensures the West Coast Data Center - San Francisco appears as an onramp
    return isInMegaportMetro;
  }, []);

  // Calculate optimal Megaport POPs using minimum viable coverage strategy
  const getOptimalMegaportPOPs = useCallback(() => {
    if (!isOptimizationView || !optimizationAnswers) return [];
    
    console.log('Calculating optimal POPs with distance threshold:', popDistanceThreshold);
    
    const { primaryGoal, budget, redundancy, latency } = optimizationAnswers;
    
    // Step 1: Analyze site geographic distribution to determine minimum POPs needed
    const siteLocations = sites.filter(site => site.coordinates);
    if (siteLocations.length === 0) return [];
    
    // Group sites by closest POP with San Francisco preference for West Coast
    const popCoverage = new Map<string, { pop: any; sites: any[]; totalSites: number }>();
    siteLocations.forEach((site: any) => {
      let closestPOP: any = null;
      let minDistance = Infinity;
      
      megaportPOPs.forEach(pop => {
        const distance = calculateDistance(site, pop);
        
        // Apply San Francisco preference for West Coast sites (x < 0.3)
        let adjustedDistance = distance;
        if (site.coordinates && site.coordinates.x < 0.3) {
          if (pop.id === 'megapop-sfo') {
            adjustedDistance = distance * 0.6; // Strong preference for SFO
          } else if (pop.id === 'megapop-lax') {
            adjustedDistance = distance * 1.5; // Penalty for LAX
          }
        }
        
        if (adjustedDistance < minDistance && distance <= popDistanceThreshold) {
          minDistance = adjustedDistance;
          closestPOP = pop;
        }
      });
      
      if (closestPOP) {
        if (!popCoverage.has(closestPOP.id)) {
          popCoverage.set(closestPOP.id, { pop: closestPOP, sites: [], totalSites: 0 });
        }
        const coverage = popCoverage.get(closestPOP.id);
        if (coverage) {
          coverage.sites.push(site);
          coverage.totalSites++;
        }
      }
    });
    
    // Step 2: Select minimum POPs based on site density and requirements
    const selectedPOPs = new Set();
    
    // Priority 1: Data Centers with onramp capability (always get dedicated POP)
    const dataCenterSites = sites.filter(site => site.category === 'Data Center');
    dataCenterSites.forEach(dcSite => {
      if (hasDataCenterOnramp(dcSite) && dcSite.coordinates) {
        const closestPOP = megaportPOPs.reduce((closest, pop) => {
          const popDistance = calculateDistance(dcSite, pop);
          const closestDistance = calculateDistance(dcSite, closest);
          
          // Apply San Francisco preference for West Coast DCs
          let adjustedPopDistance = popDistance;
          let adjustedClosestDistance = closestDistance;
          
          if (dcSite.coordinates && dcSite.coordinates.x < 0.3) {
            if (pop.id === 'megapop-sfo') {
              adjustedPopDistance = popDistance * 0.6;
            } else if (pop.id === 'megapop-lax') {
              adjustedPopDistance = popDistance * 1.5;
            }
            
            if (closest.id === 'megapop-sfo') {
              adjustedClosestDistance = closestDistance * 0.6;
            } else if (closest.id === 'megapop-lax') {
              adjustedClosestDistance = closestDistance * 1.5;
            }
          }
          
          return adjustedPopDistance < adjustedClosestDistance ? pop : closest;
        });
        selectedPOPs.add(closestPOP.id);
      }
    });
    
    // Priority 2: POPs covering the most sites (efficiency-first approach with SFO preference)
    const sortedCoverage = Array.from(popCoverage.entries())
      .sort((a, b) => {
        const siteDiff = b[1].totalSites - a[1].totalSites;
        // If site counts are close, prefer San Francisco
        if (Math.abs(siteDiff) <= 1) {
          if (a[0] === 'megapop-sfo') return -1;
          if (b[0] === 'megapop-sfo') return 1;
        }
        return siteDiff;
      });
    
    // Start with the POP that covers the most sites
    if (sortedCoverage.length > 0) {
      selectedPOPs.add(sortedCoverage[0][0]);
    }
    
    // Step 3: Add additional POPs only if requirements dictate
    if (budget === 'minimal') {
      // Minimal budget: Use only 1-2 strategic POPs, no matter what
      // Keep only the most efficient POP unless redundancy is critical
      if (redundancy === 'mission-critical' && sortedCoverage.length > 1) {
        selectedPOPs.add(sortedCoverage[1][0]); // Add second most efficient POP
      }
    } else {
      // Add POPs for uncovered sites only if economically justified
      const coveredSites = new Set();
      selectedPOPs.forEach(popId => {
        const coverage = popCoverage.get(popId);
        if (coverage) {
          coverage.sites.forEach(site => coveredSites.add(site.id));
        }
      });
      
      // Check for uncovered sites that need additional POPs
      const uncoveredSites = siteLocations.filter(site => !coveredSites.has(site.id));
      
      if (uncoveredSites.length > 0) {
        // Find the most efficient POP for uncovered sites
        for (const [popId, coverage] of sortedCoverage) {
          if (!selectedPOPs.has(popId)) {
            const uncoveredByCurrent = coverage.sites.filter(site => !coveredSites.has(site.id));
            if (uncoveredByCurrent.length >= 2 || primaryGoal === 'performance') {
              selectedPOPs.add(popId);
              uncoveredByCurrent.forEach(site => coveredSites.add(site.id));
              break; // Only add one additional POP unless performance is critical
            }
          }
        }
      }
      
      // Redundancy: Add geographically diverse POP only if explicitly required
      if (redundancy === 'high' || redundancy === 'mission-critical') {
        const activePOPLocations = Array.from(selectedPOPs).map(id => 
          megaportPOPs.find(pop => pop.id === id)
        );
        
        // Find a POP that's geographically diverse (>1200 miles away)
        for (const pop of megaportPOPs) {
          if (!selectedPOPs.has(pop.id)) {
            const isGeographicallyDiverse = activePOPLocations.every(activePOP => {
              const dx = Math.abs(pop.x - activePOP.x) * 2800;
              const dy = Math.abs(pop.y - activePOP.y) * 1600;
              const distance = Math.sqrt(dx * dx + dy * dy);
              return distance > 1200;
            });
            
            if (isGeographicallyDiverse) {
              selectedPOPs.add(pop.id);
              break; // Only add one redundancy POP
            }
          }
        }
      }
    }
    
    // Return selected POPs with active flag
    return megaportPOPs.map(pop => ({
      ...pop,
      active: selectedPOPs.has(pop.id)
    })).filter(pop => pop.active);
  }, [isOptimizationView, optimizationAnswers, sites, hasDataCenterOnramp, megaportPOPs, calculateDistance, popDistanceThreshold]);

  // Calculate POP heat map scores for each site
  const calculatePOPHeatMap = useCallback(() => {
    if (!isOptimizationView || !optimizationAnswers) return new Map();
    
    const heatMap = new Map();
    
    sites.forEach(site => {
      if (!site.coordinates) return;
      
      const siteScores = megaportPOPs.map(pop => {
        const distance = calculateDistance(site, pop);
        
        // Base score factors
        let score = 0;
        
        // Distance factor (closer = higher score)
        const maxDistance = 2500; // Maximum meaningful distance in miles
        const distanceScore = Math.max(0, (maxDistance - distance) / maxDistance) * 40;
        score += distanceScore;
        
        // Cost factor based on questionnaire (prioritize major hubs, exclude LAX)
        if (optimizationAnswers.budget === 'minimal' && ['megapop-nyc', 'megapop-sfo', 'megapop-chi'].includes(pop.id)) {
          score += 20; // Prefer tier-1 POPs for cost optimization
        } else if (optimizationAnswers.budget === 'substantial') {
          score += 10; // All POPs are viable
        }
        
        // Additional preference for San Francisco over Los Angeles for West Coast
        if (pop.id === 'megapop-sfo') {
          score += 10; // Bonus for primary West Coast facility
        } else if (pop.id === 'megapop-lax') {
          score -= 5; // Slight penalty for secondary West Coast facility
        }
        
        // Performance factor
        if (optimizationAnswers.latency === 'critical' || optimizationAnswers.latency === 'low') {
          if (distance < 800) score += 25; // Bonus for POPs within 800 miles
        }
        
        // Redundancy factor
        if (optimizationAnswers.redundancy === 'high' || optimizationAnswers.redundancy === 'mission-critical') {
          // Bonus for POPs that provide geographic diversity
          const otherPOPs = megaportPOPs.filter(p => p.id !== pop.id);
          const hasNearbyRedundancy = otherPOPs.some(otherPOP => {
            const dx = Math.abs(pop.x - otherPOP.x) * 2800;
            const dy = Math.abs(pop.y - otherPOP.y) * 1600;
            const redundancyDistance = Math.sqrt(dx * dx + dy * dy);
            return redundancyDistance < 1200; // Close enough for redundancy (within 1200 miles)
          });
          if (hasNearbyRedundancy) score += 15;
        }
        
        // Data Center onramp bonus
        if (hasDataCenterOnramp(site)) {
          score += 30; // Significant bonus for direct onramp capability
        }
        
        // Normalize score to 0-100
        return {
          popId: pop.id,
          popName: pop.name,
          score: Math.min(100, Math.max(0, score)),
          distance: distance,
          factors: {
            distance: distanceScore,
            cost: optimizationAnswers.budget === 'minimal' && ['megapop-nyc', 'megapop-sfo', 'megapop-chi'].includes(pop.id) ? 20 : 10,
            performance: (optimizationAnswers.latency === 'critical' && distance < 800) ? 25 : 0,
            redundancy: 0, // Calculated above
            onramp: hasDataCenterOnramp(site) ? 30 : 0
          }
        };
      });
      
      // Sort by score (highest first)
      siteScores.sort((a, b) => b.score - a.score);
      heatMap.set(site.id, siteScores);
    });
    
    return heatMap;
  }, [sites, megaportPOPs, calculateDistance, optimizationAnswers, isOptimizationView, hasDataCenterOnramp]);

  const popHeatMap = calculatePOPHeatMap();

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
  }, [isDragging, isDraggingCloud, isPanning, lastPanPoint, panOffset, zoom, dimensions, onUpdateSiteCoordinates, onUpdateWANCloud, dragOffset]);

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

  // Render Megaport central hub and connections
  const renderMegaportOptimization = () => {
    if (!isOptimizationView || !optimizationAnswers) return null;
    
    const optimalPOPs = getOptimalMegaportPOPs();
    
    // Central Megaport hub position (center of screen)
    const centerX = dimensions.width * 0.5;
    const centerY = dimensions.height * 0.5;
    
    return (
      <g>
        {/* Central Megaport Hub */}
        <circle
          cx={centerX}
          cy={centerY}
          r="60"
          fill="#f97316"
          fillOpacity="0.1"
          stroke="#f97316"
          strokeWidth="3"
        />
        
        <circle
          cx={centerX}
          cy={centerY}
          r="30"
          fill="#f97316"
          stroke="white"
          strokeWidth="3"
        />
        
        <text
          x={centerX}
          y={centerY + 5}
          textAnchor="middle"
          fontSize="16"
          fontWeight="bold"
          fill="#1f2937"
          stroke="white"
          strokeWidth="3"
          paintOrder="stroke fill"
        >
          MEGAPORT
        </text>
        
        <text
          x={centerX}
          y={centerY - 75}
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill="#f97316"
        >
          NaaS Transformation Hub
        </text>
        
        {/* West Coast Data Center as Megaport Onramp */}
        {(() => {
          const westCoastDC = sites.find(s => 
            (s.name.toLowerCase().includes('west coast') || 
             s.name.toLowerCase().includes('san francisco') ||
             s.location.toLowerCase().includes('san francisco')) && 
            s.category === 'Data Center' && 
            hasDataCenterOnramp(s)
          );
          
          console.log('Looking for West Coast DC:', westCoastDC);
          
          if (!westCoastDC || !westCoastDC.coordinates) {
            return null;
          }
          
          // Position DC as additional POP around the hub
          const dcAngle = -Math.PI / 4; // Upper left position
          const dcRadius = 120;
          const dcX = centerX + Math.cos(dcAngle) * dcRadius;
          const dcY = centerY + Math.sin(dcAngle) * dcRadius;
          
          return (
            <g key="westcoast-dc-onramp">
              {/* Connection to central hub */}
              <line
                x1={centerX}
                y1={centerY}
                x2={dcX}
                y2={dcY}
                stroke="#f97316"
                strokeWidth="3"
                strokeOpacity="0.8"
              />
              
              {/* DC Onramp circle */}
              <circle
                cx={dcX}
                cy={dcY}
                r="22"
                fill="#f97316"
                fillOpacity="0.4"
                stroke="#f97316"
                strokeWidth="3"
              />
              
              {/* DC Onramp label */}
              <text
                x={dcX}
                y={dcY + 3}
                textAnchor="middle"
                fontSize="7"
                fontWeight="bold"
                fill="white"
              >
                ONRAMP
              </text>
              
              <text
                x={dcX}
                y={dcY + 35}
                textAnchor="middle"
                fontSize="9"
                fontWeight="500"
                fill="#f97316"
              >
                West Coast DC
              </text>
            </g>
          );
        })()}

        {/* Regional POPs positioned around the hub */}
        {optimalPOPs.map((pop, index) => {
          // Position POPs in a circle around the central hub
          const angle = (index * 2 * Math.PI) / optimalPOPs.length;
          const radius = 120;
          const popX = centerX + Math.cos(angle) * radius;
          const popY = centerY + Math.sin(angle) * radius;
          
          return (
            <g key={pop.id}>
              {/* POP circle */}
              <circle
                cx={popX}
                cy={popY}
                r="20"
                fill="#f97316"
                fillOpacity="0.3"
                stroke="#f97316"
                strokeWidth="2"
              />
              
              {/* POP label */}
              <text
                x={popX}
                y={popY + 3}
                textAnchor="middle"
                fontSize="8"
                fontWeight="bold"
                fill="white"
              >
                POP
              </text>
              
              <text
                x={popX}
                y={popY + 35}
                textAnchor="middle"
                fontSize="9"
                fontWeight="500"
                fill="#f97316"
              >
                {pop.name}
              </text>
              
              {/* Heat map overlay */}
              {showHeatMap && (() => {
                // Calculate average heat score for this POP across all sites
                let totalScore = 0;
                let siteCount = 0;
                popHeatMap.forEach((siteScores) => {
                  const popScore = siteScores.find(score => score.popId === pop.id);
                  if (popScore) {
                    totalScore += popScore.score;
                    siteCount++;
                  }
                });
                const avgScore = siteCount > 0 ? totalScore / siteCount : 0;
                
                // Heat intensity overlay
                const heatIntensity = avgScore / 100;
                const heatColor = `hsl(${120 * heatIntensity}, 70%, ${50 + (heatIntensity * 20)}%)`;
                
                return (
                  <>
                    <circle
                      cx={popX}
                      cy={popY}
                      r="22"
                      fill={heatColor}
                      fillOpacity="0.6"
                      stroke={heatColor}
                      strokeWidth="1"
                    />
                    <text
                      x={popX}
                      y={popY - 35}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#374151"
                    >
                      {Math.round(avgScore)}
                    </text>
                  </>
                );
              })()}
              
              {/* Connection from POP to central hub */}
              <line
                x1={popX}
                y1={popY}
                x2={centerX}
                y2={centerY}
                stroke="#f97316"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
              />
            </g>
          );
        })}
        
        {/* Connect customer sites to nearest optimal POPs */}
        {sites.map(site => {
          const sitePos = sitePositions[site.id];
          if (!sitePos) return null;
          
          // Find nearest POP within acceptable distance threshold
          let nearestPOP: { x: number; y: number; id: string; name: string; } | null = null;
          let minDistance = Infinity;
          
          optimalPOPs.forEach((pop, index) => {
            const angle = (index * 2 * Math.PI) / optimalPOPs.length;
            const radius = 120;
            const popX = centerX + Math.cos(angle) * radius;
            const popY = centerY + Math.sin(angle) * radius;
            
            // Use the actual distance calculation with threshold
            const distance = calculateDistance(site, pop);
            if (distance < minDistance && distance >= 500 && distance <= popDistanceThreshold) {
              minDistance = distance;
              nearestPOP = { x: popX, y: popY, id: pop.id, name: pop.name };
            }
          });
          
          // Check if site is a Data Center with onramp capability
          const isDataCenterOnramp = hasDataCenterOnramp(site);
          
          // Determine connection type and redundancy
          const internetConnections = site.connections.filter(conn => 
            conn.type.toLowerCase().includes('internet')
          );
          const hasRedundantConnection = internetConnections.length > 1 || 
            internetConnections.some(conn => conn.type.toLowerCase().includes('backup'));
          
          // Ensure every site connects to Megaport - if no optimal POP found, connect to closest available
          if (!nearestPOP && !isDataCenterOnramp) {
            // Find closest POP regardless of distance constraint for connectivity
            optimalPOPs.forEach((pop, index) => {
              const angle = (index * 2 * Math.PI) / optimalPOPs.length;
              const radius = 120;
              const popX = centerX + Math.cos(angle) * radius;
              const popY = centerY + Math.sin(angle) * radius;
              
              const distance = calculateDistance(site, pop);
              if (distance < minDistance) {
                minDistance = distance;
                nearestPOP = { x: popX, y: popY, id: pop.id, name: pop.name };
              }
            });
          }
          
          if (!nearestPOP && !isDataCenterOnramp) return null;
          
          // For Data Centers with onramp, connect directly to central hub
          const targetX = isDataCenterOnramp ? centerX : nearestPOP?.x;
          const targetY = isDataCenterOnramp ? centerY : nearestPOP?.y;
          
          if (!targetX || !targetY) return null;
          
          return (
            <g key={`connection-${site.id}`}>
              <line
                x1={sitePos.x}
                y1={sitePos.y}
                x2={targetX}
                y2={targetY}
                stroke={isDataCenterOnramp ? "#f97316" : "#10b981"}
                strokeWidth="2"
                strokeDasharray={hasRedundantConnection ? "none" : "3,3"}
                opacity="0.8"
              />
              
              {/* Connection label */}
              <text
                x={(sitePos.x + targetX) / 2}
                y={(sitePos.y + targetY) / 2 - 5}
                textAnchor="middle"
                fontSize="8"
                fontWeight="500"
                fill={isDataCenterOnramp ? "#f97316" : "#10b981"}
              >
                {isDataCenterOnramp ? "Direct Onramp" : hasRedundantConnection ? "Redundant Internet" : "Internet"}
              </text>
              
              {/* Data Center onramp indicator */}
              {isDataCenterOnramp && (
                <circle
                  cx={sitePos.x}
                  cy={sitePos.y - 30}
                  r="8"
                  fill="#f97316"
                  stroke="white"
                  strokeWidth="2"
                />
              )}
              {isDataCenterOnramp && (
                <text
                  x={sitePos.x}
                  y={sitePos.y - 27}
                  textAnchor="middle"
                  fontSize="6"
                  fontWeight="bold"
                  fill="white"
                >
                  ON
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
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
          {/* Render in layers: connections first, then clouds, then optimization, then sites */}
          {!isOptimizationView && renderConnections()}
          {!isOptimizationView && renderClouds()}
          {renderMegaportOptimization()}
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

        {/* Network Optimization Toggle */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
          <Button
            size="sm"
            onClick={() => {
              if (isOptimizationView) {
                setIsOptimizationView(false);
                setOptimizationAnswers(null);
              } else {
                setShowOptimizationQuestionnaire(true);
              }
            }}
            className={`w-full ${isOptimizationView 
              ? 'bg-orange-500 hover:bg-orange-600 text-white' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            data-testid="button-optimize-network"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isOptimizationView ? 'Exit Optimization' : 'Optimize my Network'}
          </Button>
        </div>

        {/* Optimization Controls - Only show when optimization is active */}
        {isOptimizationView && optimizationAnswers && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Optimization Profile</span>
                <Zap className="h-3 w-3 text-orange-500" />
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div>Goal: <span className="font-medium">{optimizationAnswers.primaryGoal.replace('-', ' ')}</span></div>
                <div>Budget: <span className="font-medium">{optimizationAnswers.budget}</span></div>
                <div>Redundancy: <span className="font-medium">{optimizationAnswers.redundancy}</span></div>
              </div>
              
              {/* Distance Threshold Slider */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Site-to-POP Distance</span>
                  <span className="text-xs text-gray-500">{Math.round(popDistanceThreshold)}mi</span>
                </div>
                <Slider
                  value={[popDistanceThreshold]}
                  onValueChange={(value) => {
                    console.log('Distance slider changed to:', value[0]);
                    setPopDistanceThreshold(value[0]);
                    // Force immediate re-calculation and visual update
                    setTimeout(() => {
                      console.log('Triggering topology update after slider change');
                    }, 10);
                  }}
                  max={2500}
                  min={500}
                  step={100}
                  className="w-full"
                  data-testid="slider-pop-distance"
                />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Close (500mi)</span>
                  <span>Extended (2500mi)</span>
                </div>
                <div className="text-xs text-gray-600">
                  {sites.filter(site => {
                    if (!site.coordinates) return false;
                    return megaportPOPs.some(pop => {
                      const distance = calculateDistance(site, pop);
                      return pop.active && distance >= 500 && distance <= popDistanceThreshold;
                    });
                  }).length} of {sites.length} sites within range
                </div>
              </div>
              
              {/* Heat Map Toggle */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">POP Selection Heat Map</span>
                  <Button
                    size="sm"
                    variant={showHeatMap ? "default" : "outline"}
                    onClick={() => setShowHeatMap(!showHeatMap)}
                    className="h-6 px-2 text-xs"
                    data-testid="button-toggle-heatmap"
                  >
                    {showHeatMap ? 'Hide' : 'Show'}
                  </Button>
                </div>
                {showHeatMap && (
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>🟢 High Score (80-100)</span>
                      <span>Best match</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>🟡 Medium Score (40-79)</span>
                      <span>Good option</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>🔴 Low Score (0-39)</span>
                      <span>Poor fit</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Dynamic Deployment Strategy Commentary */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <span className="text-xs font-medium text-gray-700">Current Deployment Strategy</span>
                {(() => {
                  const optimalPOPs = getOptimalMegaportPOPs();
                  const westCoastDC = sites.find(s => s.name.toLowerCase().includes('west coast') && s.category === 'Data Center');
                  
                  if (!optimalPOPs.length) return null;
                  
                  // Calculate site connections and distances
                  const siteConnections = new Map();
                  const distances: { site: string; distance: number }[] = [];
                  let westCoastSites = 0;
                  
                  sites.forEach((site: any) => {
                    if (!site.coordinates) return;
                    
                    // Check if connects to West Coast DC
                    if (westCoastDC && westCoastDC.coordinates) {
                      const dcDistance = calculateDistance(site, westCoastDC);
                      if (dcDistance <= popDistanceThreshold && dcDistance < 1500) {
                        westCoastSites++;
                        distances.push({ site: site.name, distance: Math.round(dcDistance) });
                        return;
                      }
                    }
                    
                    // Find nearest POP
                    let closestPOP = null;
                    let minDistance = Infinity;
                    
                    optimalPOPs.forEach(pop => {
                      const distance = calculateDistance(site, pop);
                      if (distance < minDistance) {
                        minDistance = distance;
                        closestPOP = pop;
                      }
                    });
                    
                    if (closestPOP) {
                      const key = closestPOP.name;
                      if (!siteConnections.has(key)) siteConnections.set(key, 0);
                      siteConnections.set(key, siteConnections.get(key) + 1);
                      distances.push({ site: site.name, distance: Math.round(minDistance) });
                    }
                  });
                  
                  const avgDistance = distances.length > 0 ? Math.round(distances.reduce((sum, d) => sum + d.distance, 0) / distances.length) : 0;
                  const longestConnection = distances.length > 0 ? distances.reduce((max, d) => d.distance > max.distance ? d : max, distances[0]) : null;
                  
                  const eastCoastConnections = Array.from(siteConnections.entries()).filter(([name]) => 
                    !name.toLowerCase().includes('san francisco') && !name.toLowerCase().includes('los angeles')
                  );
                  
                  return (
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>
                        <strong>Your current deployment utilizes {optimalPOPs.length} Megaport {optimalPOPs.length === 1 ? 'facility' : 'facilities'}:</strong>
                      </div>
                      
                      {westCoastSites > 0 && (
                        <div>• {westCoastSites} {westCoastSites === 1 ? 'site' : 'sites'} connected to West Coast Data Center</div>
                      )}
                      
                      {Array.from(siteConnections.entries()).map(([popName, count]) => (
                        <div key={popName}>• {count} {count === 1 ? 'site' : 'sites'} connected to Megaport virtual edge in {popName}</div>
                      ))}
                      
                      <div className="mt-2 pt-1 border-t border-gray-300">
                        <div>• Average distance from Megaport: <strong>{avgDistance} miles</strong></div>
                        {longestConnection && (
                          <div>• Longest distance: <strong>{longestConnection.site} ({longestConnection.distance} miles)</strong></div>
                        )}
                        <div>• Distance threshold: <strong>{Math.round(popDistanceThreshold)} miles</strong></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowOptimizationQuestionnaire(true)}
                className="w-full text-xs"
                data-testid="button-edit-optimization"
              >
                Edit Requirements
              </Button>
            </div>
          </div>
        )}

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
            {isOptimizationView ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-600">• Solid lines = Redundant connections</p>
                <p className="text-xs text-gray-600">• Dashed lines = Single connections</p>
                <p className="text-xs text-gray-600">• Orange = Data Center onramp</p>
                <p className="text-xs text-gray-600">• Green = Internet to POP</p>
                {showHeatMap && (
                  <p className="text-xs text-gray-600">• Heat map shows POP suitability scores</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-gray-600">• Double-click sites/clouds to edit</p>
                <p className="text-xs text-gray-600">• Drag sites to reposition</p>
                <p className="text-xs text-gray-600">• MPLS creates mesh connectivity</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Heat Map Analysis Panel */}
        {isOptimizationView && showHeatMap && (
          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Site-to-POP Analysis</span>
                <span className="text-xs text-gray-500">Scores based on distance, cost, performance</span>
              </div>
              
              <div className="space-y-2">
                {sites.slice(0, 8).map(site => {
                  const siteScores = popHeatMap.get(site.id) || [];
                  const topPOP = siteScores[0];
                  
                  if (!topPOP) return null;
                  
                  const scoreColor = topPOP.score >= 80 ? 'text-green-600' : 
                                   topPOP.score >= 40 ? 'text-yellow-600' : 'text-red-600';
                  
                  return (
                    <div key={site.id} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-32">{site.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600">{topPOP.popName}</span>
                        <span className={`font-medium ${scoreColor}`}>
                          {Math.round(topPOP.score)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
                {sites.length > 8 && (
                  <div className="text-xs text-gray-500 text-center pt-1">
                    + {sites.length - 8} more sites
                  </div>
                )}
              </div>
              
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-600 space-y-1">
                  <div><strong>Scoring Factors:</strong></div>
                  <div>• Distance: Closer POPs score higher</div>
                  <div>• Efficiency: POPs covering most sites preferred</div>
                  <div>• Cost: Budget constraints limit POP count</div>
                  <div>• Performance: Latency needs may require additional POPs</div>
                  <div>• Redundancy: Geographic diversity only when required</div>
                  <div>• Onramp: Data Centers get dedicated POPs</div>
                </div>
                
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                  <strong>Example:</strong> If you only have sites in Dallas, you'll get Dallas POP only. 
                  Houston won't be suggested unless you have sites there or need redundancy.
                </div>
              </div>
            </div>
          </div>
        )}
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

      {/* Optimization Questionnaire Dialog */}
      <Dialog 
        open={showOptimizationQuestionnaire} 
        onOpenChange={setShowOptimizationQuestionnaire}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Network Optimization Assessment
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <p className="text-sm text-gray-600">
              Answer these questions to generate intelligent Megaport NaaS recommendations tailored to your specific requirements.
            </p>
            
            {/* Primary Goal */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">What is your primary optimization goal?</Label>
              <RadioGroup
                value={optimizationAnswers?.primaryGoal || ''}
                onValueChange={(value) => setOptimizationAnswers(prev => ({ 
                  ...prev, 
                  primaryGoal: value,
                  budget: prev?.budget || '',
                  redundancy: prev?.redundancy || '',
                  latency: prev?.latency || '',
                  compliance: prev?.compliance || '',
                  timeline: prev?.timeline || ''
                }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cost-reduction" id="cost-reduction" />
                  <Label htmlFor="cost-reduction" className="text-sm">Cost Reduction - Minimize operational expenses</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="performance" id="performance" />
                  <Label htmlFor="performance" className="text-sm">Performance - Maximize speed and reliability</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="agility" id="agility" />
                  <Label htmlFor="agility" className="text-sm">Agility - Enable rapid provisioning and scaling</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="modernization" id="modernization" />
                  <Label htmlFor="modernization" className="text-sm">Modernization - Replace legacy MPLS infrastructure</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Budget */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">What is your budget flexibility for network transformation?</Label>
              <RadioGroup
                value={optimizationAnswers?.budget || ''}
                onValueChange={(value) => setOptimizationAnswers(prev => ({ 
                  ...prev!, 
                  budget: value 
                }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="minimal" id="minimal" />
                  <Label htmlFor="minimal" className="text-sm">Minimal - Must reduce current costs</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderate" id="moderate" />
                  <Label htmlFor="moderate" className="text-sm">Moderate - Similar to current spend</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="substantial" id="substantial" />
                  <Label htmlFor="substantial" className="text-sm">Substantial - Can invest for long-term benefits</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Redundancy */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">What level of redundancy do you require?</Label>
              <RadioGroup
                value={optimizationAnswers?.redundancy || ''}
                onValueChange={(value) => setOptimizationAnswers(prev => ({ 
                  ...prev!, 
                  redundancy: value 
                }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="basic" id="basic" />
                  <Label htmlFor="basic" className="text-sm">Basic - Standard internet backup</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="high" />
                  <Label htmlFor="high" className="text-sm">High - Multiple path redundancy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mission-critical" id="mission-critical" />
                  <Label htmlFor="mission-critical" className="text-sm">Mission Critical - Zero downtime tolerance</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Latency */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">How critical is low latency for your applications?</Label>
              <RadioGroup
                value={optimizationAnswers?.latency || ''}
                onValueChange={(value) => setOptimizationAnswers(prev => ({ 
                  ...prev!, 
                  latency: value 
                }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="normal" />
                  <Label htmlFor="normal" className="text-sm">Normal - Standard business applications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="low" id="low" />
                  <Label htmlFor="low" className="text-sm">Low - Real-time collaboration tools</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="critical" id="critical" />
                  <Label htmlFor="critical" className="text-sm">Critical - Trading, gaming, or voice applications</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Compliance */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Do you have specific compliance requirements?</Label>
              <RadioGroup
                value={optimizationAnswers?.compliance || ''}
                onValueChange={(value) => setOptimizationAnswers(prev => ({ 
                  ...prev!, 
                  compliance: value 
                }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none" className="text-sm">None - Standard business requirements</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="industry" id="industry" />
                  <Label htmlFor="industry" className="text-sm">Industry - HIPAA, PCI-DSS, or similar</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="government" id="government" />
                  <Label htmlFor="government" className="text-sm">Government - FedRAMP or high security</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">What is your implementation timeline?</Label>
              <RadioGroup
                value={optimizationAnswers?.timeline || ''}
                onValueChange={(value) => setOptimizationAnswers(prev => ({ 
                  ...prev!, 
                  timeline: value 
                }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="immediate" id="immediate" />
                  <Label htmlFor="immediate" className="text-sm">Immediate - Within 30 days</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="planned" id="planned" />
                  <Label htmlFor="planned" className="text-sm">Planned - 3-6 months</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="strategic" id="strategic" />
                  <Label htmlFor="strategic" className="text-sm">Strategic - 6-12 months</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowOptimizationQuestionnaire(false)}
                data-testid="button-cancel-optimization"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (optimizationAnswers?.primaryGoal && optimizationAnswers?.budget && 
                      optimizationAnswers?.redundancy && optimizationAnswers?.latency && 
                      optimizationAnswers?.compliance && optimizationAnswers?.timeline) {
                    setIsOptimizationView(true);
                    setShowOptimizationQuestionnaire(false);
                  }
                }}
                disabled={!optimizationAnswers?.primaryGoal || !optimizationAnswers?.budget || 
                         !optimizationAnswers?.redundancy || !optimizationAnswers?.latency || 
                         !optimizationAnswers?.compliance || !optimizationAnswers?.timeline}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="button-generate-recommendations"
              >
                Generate Recommendations
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}