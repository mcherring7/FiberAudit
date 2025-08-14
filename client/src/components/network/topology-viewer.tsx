import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const panVelocity = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editingWANCloud, setEditingWANCloud] = useState<WANCloud | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const [hiddenClouds, setHiddenClouds] = useState<Set<string>>(new Set());
  const [connectionVisibility, setConnectionVisibility] = useState({
    siteToCloud: true,        // Site-to-WAN cloud connections
    mplsMesh: true,           // MPLS mesh (site-to-site) connections - enabled by default
    bandwidthLabels: true,    // Bandwidth labels on connections
    pointToPoint: true        // Point-to-point connections
  });

  // Individual WAN cloud visibility controls
  const [cloudVisibility, setCloudVisibility] = useState<Record<string, boolean>>({
    internet: true,
    mpls: true,
    'azure-hub': true,
    'aws-hub': true,
    'gcp-hub': true,
    megaport: true
  });
  const [showAddCloudDialog, setShowAddCloudDialog] = useState(false);
  const [showOptimizationQuestionnaire, setShowOptimizationQuestionnaire] = useState(false);

  // Network optimization view state
  const [isOptimizationView, setIsOptimizationView] = useState(false);
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

  // Collapsible panel states
  const [collapsedPanels, setCollapsedPanels] = useState({
    viewControls: false,
    connectionLines: false,
    optimization: false
  });
  const [heatMapData, setHeatMapData] = useState<{
    sites: { id: string; name: string; x: number; y: number; nearestPOP: string; distance: number; efficiency: number }[];
    pops: { id: string; name: string; x: number; y: number; coverage: number; efficiency: number }[];
  }>({ sites: [], pops: [] });

  // Base WAN cloud definitions - positions will be overridden by cloudPositions state
  // In optimization view, clouds are positioned above the Megaport ring
  const baseWanClouds: WANCloud[] = [
    { id: 'internet', type: 'Internet', name: 'Internet WAN', x: 0.35, y: 0.5, color: '#3b82f6' },
    { id: 'mpls', type: 'MPLS', name: 'MPLS WAN', x: 0.65, y: 0.5, color: '#8b5cf6' },
    { id: 'azure-hub', type: 'Azure', name: 'Azure ExpressRoute', x: 0.25, y: 0.15, color: '#0078d4' },
    { id: 'aws-hub', type: 'AWS', name: 'AWS Direct Connect', x: 0.1, y: 0.15, color: '#ff9900' },
    { id: 'gcp-hub', type: 'GCP', name: 'Google Cloud', x: 0.5, y: 0.15, color: '#4285f4' },
    { id: 'megaport', type: 'NaaS', name: 'Megaport NaaS', x: 0.5, y: 0.5, color: '#f97316' }
  ];

  // Define center coordinates for optimization view
  const centerX = dimensions.width * 0.5;
  const centerY = dimensions.height * 0.5;

  // Real Megaport POP locations ordered geographically (west to east)
  const [megaportPOPs, setMegaportPOPs] = useState([
    { 
      id: 'megapop-sea', 
      name: 'Seattle', 
      address: '2001 6th Avenue, Seattle, WA 98121',
      x: 0.05, y: 0.15, active: false, isCustom: false 
    },
    { 
      id: 'megapop-sfo', 
      name: 'San Francisco', 
      address: '365 Main Street, San Francisco, CA 94105',
      x: 0.08, y: 0.35, active: false, isCustom: false 
    },
    { 
      id: 'megapop-lax', 
      name: 'Los Angeles', 
      address: '600 West 7th Street, Los Angeles, CA 90017',
      x: 0.15, y: 0.75, active: false, isCustom: false 
    },
    { 
      id: 'megapop-dal', 
      name: 'Dallas', 
      address: '2323 Bryan Street, Dallas, TX 75201',
      x: 0.55, y: 0.75, active: false, isCustom: false 
    },
    { 
      id: 'megapop-hou', 
      name: 'Houston', 
      address: '2626 Spring Cypress Road, Spring, TX 77388',
      x: 0.5, y: 0.8, active: false, isCustom: false 
    },
    { 
      id: 'megapop-chi', 
      name: 'Chicago', 
      address: '350 East Cermak Road, Chicago, IL 60616',
      x: 0.65, y: 0.35, active: false, isCustom: false 
    },
    { 
      id: 'megapop-res', 
      name: 'Reston', 
      address: '12100 Sunrise Valley Drive, Reston, VA 20191',
      x: 0.82, y: 0.4, active: false, isCustom: false 
    },
    { 
      id: 'megapop-nyc', 
      name: 'New York', 
      address: '600 Hudson Street, New York, NY 10013',
      x: 0.85, y: 0.25, active: false, isCustom: false 
    },
    { 
      id: 'megapop-mia', 
      name: 'Miami', 
      address: '36 NE 2nd Street, Miami, FL 33132',
      x: 0.85, y: 0.95, active: false, isCustom: false 
    }
  ]);

  // State for managing custom Megaport onramp dialog
  const [showAddOnrampDialog, setShowAddOnrampDialog] = useState(false);

  // Calculate distance between site and POP in miles using canvas coordinates
  const calculateDistance = useCallback((site: Site, pop: any) => {
    if (!site.coordinates) return Infinity;

    // Convert normalized coordinates to approximate miles
    // US is roughly 2,800 miles wide and 1,600 miles tall
    const dx = Math.abs(site.coordinates.x - pop.x) * 2800;
    const dy = Math.abs(site.coordinates.y - pop.y) * 1600;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate real geographic distance based on site location name and POP city
  const calculateRealDistance = useCallback((siteLocation: string, pop: any) => {
    // Comprehensive geographic distance mapping - updated with Seattle POP
    const cityDistances: Record<string, Record<string, number>> = {
      // West Coast locations
      'san francisco': { 'megapop-sfo': 0, 'megapop-lax': 350, 'megapop-sea': 800, 'megapop-chi': 1850, 'megapop-dal': 1450, 'megapop-hou': 1650, 'megapop-mia': 2580, 'megapop-res': 2850, 'megapop-nyc': 2900 },
      'los angeles': { 'megapop-lax': 0, 'megapop-sfo': 350, 'megapop-sea': 1150, 'megapop-chi': 1750, 'megapop-dal': 1240, 'megapop-hou': 1370, 'megapop-mia': 2340, 'megapop-res': 2300, 'megapop-nyc': 2450 },
      'seattle': { 'megapop-sea': 0, 'megapop-sfo': 800, 'megapop-lax': 1150, 'megapop-chi': 1740, 'megapop-dal': 1650, 'megapop-hou': 1890, 'megapop-mia': 2735, 'megapop-res': 2330, 'megapop-nyc': 2400 },
      'portland': { 'megapop-sea': 170, 'megapop-sfo': 635, 'megapop-lax': 965, 'megapop-chi': 1750, 'megapop-dal': 1620, 'megapop-hou': 1850, 'megapop-mia': 2700, 'megapop-res': 2350, 'megapop-nyc': 2450 },
      'las vegas': { 'megapop-lax': 270, 'megapop-sfo': 570, 'megapop-sea': 870, 'megapop-chi': 1520, 'megapop-dal': 1050, 'megapop-hou': 1230, 'megapop-mia': 2030, 'megapop-res': 2100, 'megapop-nyc': 2230 },
      'phoenix': { 'megapop-lax': 370, 'megapop-sfo': 650, 'megapop-sea': 1120, 'megapop-chi': 1440, 'megapop-dal': 890, 'megapop-hou': 1020, 'megapop-mia': 1890, 'megapop-res': 2000, 'megapop-nyc': 2140 },

      // Central locations  
      'denver': { 'megapop-chi': 920, 'megapop-dal': 660, 'megapop-hou': 880, 'megapop-sfo': 950, 'megapop-lax': 830, 'megapop-sea': 1320, 'megapop-mia': 1730, 'megapop-res': 1500, 'megapop-nyc': 1630 },
      'chicago': { 'megapop-chi': 0, 'megapop-dal': 925, 'megapop-hou': 940, 'megapop-sfo': 1850, 'megapop-lax': 1750, 'megapop-sea': 1740, 'megapop-mia': 1190, 'megapop-res': 580, 'megapop-nyc': 710 },
      'dallas': { 'megapop-dal': 0, 'megapop-hou': 240, 'megapop-chi': 925, 'megapop-sfo': 1450, 'megapop-lax': 1240, 'megapop-sea': 1650, 'megapop-mia': 1120, 'megapop-res': 1200, 'megapop-nyc': 1370 },
      'houston': { 'megapop-hou': 0, 'megapop-dal': 240, 'megapop-chi': 940, 'megapop-sfo': 1650, 'megapop-lax': 1370, 'megapop-sea': 1890, 'megapop-mia': 970, 'megapop-res': 1220, 'megapop-nyc': 1420 },
      'minneapolis': { 'megapop-chi': 350, 'megapop-dal': 860, 'megapop-hou': 1040, 'megapop-sfo': 1585, 'megapop-lax': 1535, 'megapop-sea': 1395, 'megapop-mia': 1250, 'megapop-res': 930, 'megapop-nyc': 1020 },
      'salt lake city': { 'megapop-sfo': 600, 'megapop-lax': 580, 'megapop-sea': 700, 'megapop-chi': 1260, 'megapop-dal': 990, 'megapop-hou': 1200, 'megapop-mia': 2080, 'megapop-res': 1900, 'megapop-nyc': 2000 },

      // East Coast locations
      'new york': { 'megapop-nyc': 0, 'megapop-res': 200, 'megapop-chi': 710, 'megapop-dal': 1370, 'megapop-hou': 1420, 'megapop-mia': 1090, 'megapop-sfo': 2900, 'megapop-lax': 2450, 'megapop-sea': 2400 },
      'miami': { 'megapop-mia': 0, 'megapop-res': 920, 'megapop-chi': 1190, 'megapop-dal': 1120, 'megapop-hou': 970, 'megapop-sfo': 2580, 'megapop-lax': 2340, 'megapop-sea': 2735, 'megapop-nyc': 1090 },
      'atlanta': { 'megapop-mia': 600, 'megapop-res': 550, 'megapop-chi': 590, 'megapop-dal': 780, 'megapop-hou': 790, 'megapop-sfo': 2140, 'megapop-lax': 1940, 'megapop-sea': 2180, 'megapop-nyc': 870 },
      'raleigh': { 'megapop-res': 230, 'megapop-mia': 630, 'megapop-chi': 630, 'megapop-dal': 1040, 'megapop-hou': 1180, 'megapop-sfo': 2370, 'megapop-lax': 2180, 'megapop-sea': 2330, 'megapop-nyc': 430 },
      'orlando': { 'megapop-mia': 230, 'megapop-res': 760, 'megapop-chi': 1000, 'megapop-dal': 1080, 'megapop-hou': 850, 'megapop-sfo': 2420, 'megapop-lax': 2220, 'megapop-sea': 2720, 'megapop-nyc': 940 }
    };

    // Extract city name from location string with enhanced matching for Seattle
    const location = siteLocation.toLowerCase();
    let closestCity = '';

    // Direct city name matches first
    Object.keys(cityDistances).forEach(city => {
      if (location.includes(city)) {
        closestCity = city;
      }
    });

    // Enhanced pattern matching for complex location names - prioritize Seattle match
    if (!closestCity) {
      if (location.includes('seattle') || location.includes('tech hub') || location.includes('tech')) {
        closestCity = 'seattle';
      } else if (location.includes('san francisco') || location.includes('west coast data center') || location.includes('bay area') || location.includes('innovation lab')) {
        closestCity = 'san francisco';
      } else if (location.includes('los angeles') || location.includes('la ')) {
        closestCity = 'los angeles';
      } else if (location.includes('portland') || location.includes('green tech') || location.includes('green')) {
        closestCity = 'portland';
      } else if (location.includes('minneapolis') || location.includes('north central') || location.includes('minnesota')) {
        closestCity = 'minneapolis';
      } else if (location.includes('orlando') || location.includes('tourism division') || location.includes('tourism')) {
        closestCity = 'orlando';
      } else if (location.includes('salt lake') || location.includes('mountain west') || location.includes('utah')) {
        closestCity = 'salt lake city';
      } else if (location.includes('raleigh') || location.includes('research triangle') || location.includes('north carolina')) {
        closestCity = 'raleigh';
      } else if (location.includes('las vegas') || location.includes('customer center')) {
        closestCity = 'las vegas';
      } else if (location.includes('phoenix') || location.includes('southwest')) {
        closestCity = 'phoenix';
      } else if (location.includes('denver') || location.includes('mountain region') || location.includes('colorado')) {
        closestCity = 'denver';
      } else if (location.includes('chicago') || location.includes('illinois') || location.includes('branch office')) {
        closestCity = 'chicago';
      } else if (location.includes('detroit') || location.includes('manufacturing') || location.includes('michigan')) {
        closestCity = 'chicago'; // Detroit is closest to Chicago POP
      } else if (location.includes('dallas') || location.includes('dfw') || location.includes('regional hub')) {
        closestCity = 'dallas';
      } else if (location.includes('houston') || location.includes('energy')) {
        closestCity = 'houston';
      } else if (location.includes('new york') || location.includes('nyc') || location.includes('headquarters')) {
        closestCity = 'new york';
      } else if (location.includes('miami') || location.includes('sales office')) {
        closestCity = 'miami';
      } else if (location.includes('atlanta') || location.includes('operations center') || location.includes('georgia')) {
        closestCity = 'atlanta';
      } else if (location.includes('boston') || location.includes('east coast hub')) {
        closestCity = 'new york'; // Boston uses NYC POP
      } else if (location.includes('nashville') || location.includes('music city')) {
        closestCity = 'atlanta'; // Nashville uses Atlanta POP
      } else {
        // Regional fallbacks - more specific
        if (location.includes('california') || location.includes('west coast')) {
          closestCity = 'san francisco';
        } else if (location.includes('washington state') || location.includes('washington') || location.includes('pacific northwest')) {
          closestCity = 'seattle';
        } else if (location.includes('texas') || location.includes('uptown')) {
          closestCity = 'dallas';
        } else if (location.includes('florida')) {
          closestCity = 'miami';
        } else if (location.includes('midwest') || location.includes('michigan') || location.includes('wisconsin') || location.includes('indiana') || location.includes('ohio')) {
          closestCity = 'chicago';
        } else if (location.includes('virginia') || location.includes('washington dc') || location.includes('reston') || location.includes('maryland')) {
          closestCity = 'new york';
        } else if (location.includes('oregon') || location.includes('washington')) {
          closestCity = 'seattle';
        } else if (location.includes('nevada') || location.includes('arizona') || location.includes('new mexico')) {
          closestCity = 'phoenix';
        } else if (location.includes('kansas') || location.includes('missouri') || location.includes('iowa') || location.includes('nebraska')) {
          closestCity = 'chicago';
        }
      }
    }

    console.log(`Location "${siteLocation}" mapped to city: "${closestCity}"`);

    if (closestCity && cityDistances[closestCity]) {
      const distance = cityDistances[closestCity][pop.id];
      if (distance !== undefined) {
        console.log(`Real distance from ${closestCity} to ${pop.id}: ${distance} miles`);
        return distance;
      }
    }

    // Default fallback distance
    console.log(`Using fallback distance for unmapped location: ${siteLocation}`);
    return 3000;
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

  // Calculate optimal Megaport POPs using improved distance-based strategy
  const getOptimalMegaportPOPs = useCallback(() => {
    if (!isOptimizationView) return [];

    console.log('=== CALCULATING OPTIMAL POPS ===');
    console.log('Distance threshold:', popDistanceThreshold, 'miles');

    const siteLocations = sites.filter(site => site.coordinates);
    console.log(`Found ${siteLocations.length} sites with coordinates:`, siteLocations.map(s => s.name));
    if (siteLocations.length === 0) return [];

    // Step 1: Find the minimum set of POPs that can serve all sites within the distance threshold
    const siteToNearestPOPs = new Map<string, Array<{ popId: string; distance: number }>>();

    // For each site, find all POPs within the distance threshold, sorted by distance
    siteLocations.forEach((site: any) => {
      const nearbyPOPs: Array<{ popId: string; distance: number }> = [];

      megaportPOPs.forEach(pop => {
        const distance = calculateRealDistance(site.name, pop);
        if (distance <= popDistanceThreshold) {
          nearbyPOPs.push({ popId: pop.id, distance });
        }
      });

      // Sort by distance (closest first)
      nearbyPOPs.sort((a, b) => a.distance - b.distance);
      siteToNearestPOPs.set(site.id, nearbyPOPs);

      console.log(`${site.name}:`);
      nearbyPOPs.slice(0, 3).forEach(pop => {
        const popName = megaportPOPs.find(p => p.id === pop.popId)?.name || pop.popId;
        console.log(`  -> ${popName}: ${Math.round(pop.distance)} miles`);
      });
    });

    // Step 2: Use greedy algorithm to find minimum set of POPs
    const selectedPOPIds = new Set<string>();
    const uncoveredSites = new Set(siteLocations.map(s => s.id));

    // Continue until all sites are covered
    while (uncoveredSites.size > 0) {
      let bestPOP: string | null = null;
      let bestCoverage = 0;

      // For each available POP, count how many uncovered sites it can serve
      megaportPOPs.forEach(pop => {
        if (selectedPOPIds.has(pop.id)) return; // Skip already selected POPs

        let coverage = 0;
        uncoveredSites.forEach(siteId => {
          const sitePOPs = siteToNearestPOPs.get(siteId) || [];
          if (sitePOPs.some(sp => sp.popId === pop.id)) {
            coverage++;
          }
        });

        if (coverage > bestCoverage) {
          bestCoverage = coverage;
          bestPOP = pop.id;
        }
      });

      if (bestPOP) {
        selectedPOPIds.add(bestPOP);
        console.log(`Selected POP ${bestPOP} covering ${bestCoverage} sites`);

        // Remove covered sites
        uncoveredSites.forEach(siteId => {
          const sitePOPs = siteToNearestPOPs.get(siteId) || [];
          if (sitePOPs.some(sp => sp.popId === bestPOP)) {
            uncoveredSites.delete(siteId);
          }
        });
      } else {
        // No POP can cover remaining sites within threshold - use closest POP for each
        console.log(`No POPs within threshold for ${uncoveredSites.size} remaining sites, using closest available`);
        uncoveredSites.forEach(siteId => {
          const site = siteLocations.find(s => s.id === siteId);
          if (!site) return;

          let closestPOP: any = null;
          let minDistance = Infinity;

          megaportPOPs.forEach(pop => {
            const distance = calculateRealDistance(site.name, pop);
            if (distance < minDistance) {
              minDistance = distance;
              closestPOP = pop;
            }
          });

          if (closestPOP) {
            selectedPOPIds.add(closestPOP.id);
            console.log(`Fallback: ${site.name} -> ${closestPOP.name}: ${Math.round(minDistance)} miles`);
          }
        });
        break;
      }
    }

    // Always ensure critical POPs are included for special cases
    const hasSeattleSites = sites.some(site => 
      site.name.toLowerCase().includes('seattle') || site.name.toLowerCase().includes('tech hub')
    );
    if (hasSeattleSites && !selectedPOPIds.has('megapop-sea')) {
      selectedPOPIds.add('megapop-sea');
      console.log('Added Seattle POP for Seattle Tech Hub');
    }

    const hasWestCoastDataCenter = sites.some(site => 
      site.category === 'Data Center' && 
      hasDataCenterOnramp(site) && 
      (site.name.toLowerCase().includes('san francisco') || site.name.toLowerCase().includes('west coast'))
    );
    if (hasWestCoastDataCenter && !selectedPOPIds.has('megapop-sfo')) {
      selectedPOPIds.add('megapop-sfo');
      console.log('Added SF POP for West Coast Data Center');
    }

    // Return active POPs in geographic order (west to east)
    const finalPOPs = megaportPOPs
      .filter(pop => selectedPOPIds.has(pop.id))
      .map(pop => ({ ...pop, active: true }))
      .sort((a, b) => a.x - b.x); // Sort west to east

    // Calculate coverage stats
    const coverageStats = new Map<string, number>();
    siteLocations.forEach(site => {
      finalPOPs.forEach(pop => {
        const distance = calculateRealDistance(site.name, pop);
        if (distance <= popDistanceThreshold) {
          coverageStats.set(pop.id, (coverageStats.get(pop.id) || 0) + 1);
        }
      });
    });

    console.log('Final Selected POPs:', finalPOPs.map(p => ({ 
      name: p.name, 
      id: p.id, 
      coverage: coverageStats.get(p.id) || 0 
    })));
    console.log(`Optimized POP count: ${finalPOPs.length} (threshold: ${popDistanceThreshold}mi)`);

    return finalPOPs;
  }, [isOptimizationView, sites, megaportPOPs, popDistanceThreshold, calculateRealDistance, hasDataCenterOnramp]);

  // Calculate ring positions for selected Megaport POPs (lower half only)
  const getMegaportRingPositions = useCallback(() => {
    const optimalPOPs = getOptimalMegaportPOPs();
    if (optimalPOPs.length === 0) return [];

    const centerX = 0.5;
    const centerY = 0.45; // Slightly higher center position
    
    // Define ring radius in normalized coordinates (0-1) - fixed radius for consistent display
    const ringRadius = 0.18; // Fixed radius for better circle appearance

    // Use 180 degrees across bottom half - WEST TO EAST (left to right)
    const startAngle = Math.PI;     // 180° (West/left side) 
    const angleRange = Math.PI;     // Full 180° range for bottom semicircle

    return optimalPOPs.map((pop, index) => {
      let angle;

      if (optimalPOPs.length === 1) {
        angle = Math.PI * 0.5; // Single POP at bottom (90°)
      } else if (optimalPOPs.length === 2) {
        // Two POPs: West (left) and East (right)
        angle = index === 0 ? Math.PI * 0.75 : Math.PI * 0.25; // 135° and 45°
      } else {
        // Multiple POPs distributed west to east across the semicircle
        const angleStep = angleRange / (optimalPOPs.length - 1);
        angle = startAngle - (index * angleStep); // Subtract to go from West to East
      }

      const x = centerX + Math.cos(angle) * ringRadius;
      const y = centerY + Math.sin(angle) * ringRadius;

      return {
        ...pop,
        x: Math.max(0.05, Math.min(0.95, x)), // Better bounds
        y: Math.max(0.3, Math.min(0.8, y)) // Keep in lower portion with better bounds
      };
    });
  }, [getOptimalMegaportPOPs, dimensions]);

  // Calculate heat map data for dynamic visualization
  const calculateHeatMapData = useCallback(() => {
    if (!isOptimizationView || !sites.length) return { sites: [], pops: [] };

    const availablePOPs = [...megaportPOPs];
    const hubCenterX = dimensions.width * 0.5;
    const hubCenterY = dimensions.height * 0.5;

    // Calculate site heat map data
    const siteHeatData = sites.filter(site => sitePositions[site.id]).map(site => {
      const sitePos = sitePositions[site.id];

      // Find nearest POP and calculate efficiency
      let nearestPOP = availablePOPs[0];
      let minDistance = calculateRealDistance(site.name, nearestPOP);

      for (const pop of availablePOPs) {
        const distance = calculateRealDistance(site.name, pop);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPOP = pop;
        }
      }

      // Calculate efficiency score (0-1) based on distance threshold
      const efficiency = Math.max(0, Math.min(1, 1 - (minDistance / popDistanceThreshold)));

      return {
        id: site.id,
        name: site.name,
        x: sitePos.x,
        y: sitePos.y,
        nearestPOP: nearestPOP.name,
        distance: minDistance,
        efficiency
      };
    });

    // Calculate POP heat map data
    const popCoverage = new Map<string, number>();
    siteHeatData.forEach(site => {
      if (site.distance <= popDistanceThreshold) {
        const nearestPOPId = availablePOPs.find(pop => pop.name === site.nearestPOP)?.id;
        if (nearestPOPId) {
          popCoverage.set(nearestPOPId, (popCoverage.get(nearestPOPId) || 0) + 1);
        }
      }
    });

    const popHeatData = availablePOPs.map((pop, index) => {
      const angle = (index * 2 * Math.PI) / availablePOPs.length;
      const ovalRadiusX = Math.min(180, dimensions.width * 0.25);
      const ovalRadiusY = Math.min(120, dimensions.height * 0.15);
      const popX = hubCenterX + Math.cos(angle) * ovalRadiusX;
      const popY = hubCenterY + Math.sin(angle) * ovalRadiusY;
      const coverage = popCoverage.get(pop.id) || 0;
      const efficiency = Math.min(1, coverage / Math.max(1, sites.length * 0.3)); // Normalize by expected coverage

      return {
        id: pop.id,
        name: pop.name,
        x: popX,
        y: popY,
        coverage,
        efficiency
      };
    });

    return { sites: siteHeatData, pops: popHeatData };
  }, [sites, megaportPOPs, popDistanceThreshold, isOptimizationView, dimensions, calculateRealDistance, sitePositions]);

  // Update heat map data when relevant parameters change
  useEffect(() => {
    if (showHeatMap) {
      setHeatMapData(calculateHeatMapData());
    }
  }, [showHeatMap, calculateHeatMapData]);

  // Toggle panel collapse state
  const togglePanel = (panelName: keyof typeof collapsedPanels) => {
    setCollapsedPanels(prev => ({
      ...prev,
      [panelName]: !prev[panelName]
    }));
  };

  // Render heat map overlay
  const renderHeatMapOverlay = () => {
    if (!showHeatMap || !isOptimizationView) return null;

    return (
      <g className="heat-map-overlay">
        {/* Site efficiency heat map */}
        {heatMapData.sites.map(site => {
          const radius = 25;
          const heatColor = site.efficiency > 0.8 ? '#10b981' : 
                           site.efficiency > 0.5 ? '#f59e0b' : '#ef4444';
          const heatOpacity = 0.3 + (site.efficiency * 0.4);

          return (
            <g key={`heat-site-${site.id}`}>
              {/* Heat zone circle */}
              <circle
                cx={site.x}
                cy={site.y}
                r={radius}
                fill={heatColor}
                fillOpacity={heatOpacity}
                stroke={heatColor}
                strokeWidth="1"
                strokeOpacity={0.6}
              />

              {/* Efficiency indicator */}
              <text
                x={site.x}
                y={site.y - radius - 5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={heatColor}
              >
                {Math.round(site.efficiency * 100)}%
              </text>

              {/* Distance to nearest POP */}
              <text
                x={site.x}
                y={site.y + radius + 15}
                textAnchor="middle"
                fontSize="9"
                fill="#6b7280"
              >
                {Math.round(site.distance)}mi to {site.nearestPOP.split(' - ')[1]}
              </text>
            </g>
          );
        })}

        {/* POP coverage heat map */}
        {heatMapData.pops.map(pop => {
          const radius = 40 + (pop.efficiency * 30);
          const coverageColor = pop.coverage > 3 ? '#8b5cf6' : 
                               pop.coverage > 1 ? '#3b82f6' : '#94a3b8';
          const coverageOpacity = 0.2 + (pop.efficiency * 0.3);

          return (
            <g key={`heat-pop-${pop.id}`}>
              {/* Coverage zone */}
              <circle
                cx={pop.x}
                cy={pop.y}
                r={radius}
                fill={coverageColor}
                fillOpacity={coverageOpacity}
                stroke={coverageColor}
                strokeWidth="2"
                strokeOpacity={0.5}
                strokeDasharray="4,4"
              />

              {/* Coverage stats */}
              <text
                x={pop.x}
                y={pop.y - radius - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={coverageColor}
              >
                {pop.coverage} sites
              </text>

              <text
                x={pop.x}
                y={pop.y - radius + 5}
                textAnchor="middle"
                fontSize="9"
                fill="#6b7280"
              >
                {Math.round(pop.efficiency * 100)}% efficiency
              </text>
            </g>
          );
        })}

        {/* Heat map legend */}
        <g transform={`translate(${dimensions.width - 200}, 50)`}>
          <rect
            x="0"
            y="0"
            width="180"
            height="120"
            fill="white"
            stroke="#e5e7eb"
            strokeWidth="1"
            rx="6"
            fillOpacity="0.95"
          />

          <text x="10" y="20" fontSize="12" fontWeight="600" fill="#374151">
            Heat Map Legend
          </text>

          {/* Site efficiency legend */}
          <text x="10" y="40" fontSize="10" fontWeight="500" fill="#6b7280">
            Site Efficiency:
          </text>
          <circle cx="20" cy="55" r="6" fill="#10b981" fillOpacity="0.7" />
          <text x="35" y="59" fontSize="9" fill="#374151">80%+ Excellent</text>
          <circle cx="20" cy="70" r="6" fill="#f59e0b" fillOpacity="0.7" />
          <text x="35" y="74" fontSize="9" fill="#374151">50-80% Good</text>
          <circle cx="20" cy="85" r="6" fill="#ef4444" fillOpacity="0.7" />
          <text x="35" y="89" fontSize="9" fill="#374151">&lt;50% Poor</text>

          {/* POP coverage legend */}
          <text x="10" y="110" fontSize="10" fontWeight="500" fill="#6b7280">
            POP Coverage: Radius = Site Count
          </text>
        </g>
      </g>
    );
  };

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

    // AWS Direct Connect connections
    if (type.includes('aws') || type.includes('direct connect') || provider.includes('aws')) {
      return wanClouds.find(c => c.type === 'AWS') || null;
    }

    // Azure ExpressRoute connections
    if (type.includes('azure') || type.includes('expressroute') || provider.includes('azure')) {
      return wanClouds.find(c => c.type === 'Azure') || null;
    }

    // Google Cloud connections
    if (type.includes('gcp') || type.includes('google') || provider.includes('google')) {
      return wanClouds.find(c => c.type === 'GCP') || null;
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

  const updatePanPosition = useCallback((deltaX: number, deltaY: number) => {
    // Batch updates to avoid multiple renders
    setPanOffset(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));
  }, []);

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

      // Apply smoothing to reduce jitter
      const smoothDeltaX = deltaX * 0.9;
      const smoothDeltaY = deltaY * 0.9;

      // Store velocity for momentum
      panVelocity.current = { x: smoothDeltaX, y: smoothDeltaY };

      // Use requestAnimationFrame for smooth updates
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        updatePanPosition(smoothDeltaX, smoothDeltaY);
        setLastPanPoint({ x, y });
      });
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
  }, [isDragging, isDraggingCloud, isPanning, lastPanPoint, panOffset, zoom, dimensions, onUpdateSiteCoordinates, onUpdateWANCloud, dragOffset, updatePanPosition]);

  const applyPanMomentum = useCallback(() => {
    if (!isPanning && (Math.abs(panVelocity.current.x) > 0.5 || Math.abs(panVelocity.current.y) > 0.5)) {
      updatePanPosition(panVelocity.current.x, panVelocity.current.y);

      // Reduce velocity
      panVelocity.current.x *= 0.92;
      panVelocity.current.y *= 0.92;

      // Continue momentum
      requestAnimationFrame(applyPanMomentum);
    }
  }, [isPanning, updatePanPosition]);

  const handleMouseUp = useCallback(() => {
    const wasPanning = isPanning;

    setIsDragging(null);
    setIsDraggingCloud(null);
    setIsPanning(false);
    setDragOffset({ x: 0, y: 0 }); // Reset drag offset

    // Apply momentum effect when stopping pan
    if (wasPanning) {
      applyPanMomentum();
    }
  }, [isPanning, applyPanMomentum]);

  // Pan functionality - only start panning if not clicking on a site or cloud
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if click target is the SVG or its background, not a site/cloud element
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

  // Cleanup animation frames on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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

  // Handle adding custom Megaport onramp
  const handleAddMegaportOnramp = useCallback((onramp: {
    name: string;
    address: string;
    city: string;
    state: string;
    coordinates?: { x: number; y: number };
  }) => {
    const newOnramp = {
      id: `megapop-custom-${Date.now()}`,
      name: onramp.city,
      address: onramp.address,
      x: onramp.coordinates?.x || Math.random() * 0.8 + 0.1, // Random position if not specified
      y: onramp.coordinates?.y || Math.random() * 0.8 + 0.1,
      active: false,
      isCustom: true
    };

    setMegaportPOPs(prev => [...prev, newOnramp]);
    setHasUnsavedChanges(true);
  }, []);

  // Handle removing custom Megaport onramp
  const handleRemoveMegaportOnramp = useCallback((onrampId: string) => {
    setMegaportPOPs(prev => prev.filter(pop => pop.id !== onrampId));
    setHasUnsavedChanges(true);
  }, []);

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

          // Create unique key using site ID, cloud ID, connection type, and index to avoid duplicates
          const connectionId = `conn-${site.id}-${targetCloud.id}-${connection.type.replace(/[^a-zA-Z0-9]/g, '')}-${index}`;
          const isHighlighted = hoveredSite === site.id || selectedSite?.id === site.id;

          connections.push(
            <line
              key={`${connectionId}-${connection.bandwidth}-${Date.now()}`}
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
              <g key={`label-${connectionId}-${connection.bandwidth}-${Date.now()}`}>
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
          {/* Cloud shape with gradient */}
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

          {/* Inner circle for icon background */}
          <circle
            cx={x}
            cy={y}
            r={iconSize/1.5}
            fill="white"
            fillOpacity="0.9"
            stroke={cloud.color}
            strokeWidth="1"
          />

          {/* Cloud icon */}
          <foreignObject
            x={x - iconSize/2}
            y={y - iconSize/2}
            width={iconSize}
            height={iconSize}
            style={{ pointerEvents: 'none' }}
          >
            <Cloud className={`w-full h-full drop-shadow-sm`} color={cloud.color} />
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

  // Initialize optimization layout positions - always set proper bottom positioning and recenter on changes
  useEffect(() => {
    if (!isOptimizationView || !sites.length || dimensions.width === 0) return;

    const customerY = dimensions.height * 0.8; // Bottom layer

    // Always update positions in optimization view to ensure proper placement
    const newPositions: Record<string, { x: number; y: number }> = {};

    // Sites will be positioned by the render function based on POP assignments
    // Just ensure all sites have the correct Y position
    sites.forEach(site => {
      const currentPos = sitePositions[site.id];
      newPositions[site.id] = { 
        x: currentPos?.x || dimensions.width / 2, 
        y: customerY 
      };
    });

    setSitePositions(prev => ({ ...prev, ...newPositions }));

    // Also update parent coordinates to maintain consistency
    Object.entries(newPositions).forEach(([siteId, pos]) => {
      onUpdateSiteCoordinates(siteId, {
        x: pos.x / dimensions.width,
        y: pos.y / dimensions.height
      });
    });

    // Reset pan and zoom to center the view when layout changes
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
  }, [isOptimizationView, sites, dimensions.width, dimensions.height, onUpdateSiteCoordinates, popDistanceThreshold]); // Add popDistanceThreshold to trigger recentering

  // Render flattened optimization layout to match reference image
  const renderFlattenedOptimization = () => {
    if (!isOptimizationView) return null;

    const optimalPOPs = getOptimalMegaportPOPs();

    // Layer positions for flattened view - matching reference image spacing
    const hyperscalerY = dimensions.height * 0.12; // Top layer - higher up
    const naasY = dimensions.height * 0.45;        // Middle layer (Megaport ring)
    const customerY = dimensions.height * 0.78;    // Bottom layer

    // Get active hyperscaler clouds and add applications
    const cloudServices = getActiveClouds().filter(cloud => 
      ['AWS', 'Azure', 'GCP'].includes(cloud.type)
    ).slice(0, 3); // Top 3 cloud providers

    // Add critical applications/services
    const applications = [
      { id: 'salesforce', name: 'Salesforce', type: 'SaaS', color: '#00A1E0' },
      { id: 'critical-apps', name: 'Critical Applications', type: 'Apps', color: '#6366f1' }
    ];

    const allTopServices = [...cloudServices, ...applications].slice(0, 4);

    // Calculate center point for Megaport hub and ring
    const centerX = dimensions.width * 0.5;
    const centerY = naasY;

    // Get ring positions for POPs (lower half only)
    const ringPOPs = getMegaportRingPositions();

    // Define ring radius for connections
    const ringRadius = Math.min(dimensions.width * 0.22, dimensions.height * 0.22);

    return (
      <g>
        {/* Top Services Layer - Cloud Providers & Applications */}
        {allTopServices.map((service, index) => {
          const spacing = Math.max(180, dimensions.width / (allTopServices.length + 1));
          const x = spacing * (index + 1);
          const y = hyperscalerY;

          // Calculate latency to nearest POP (simulated)
          const latencies = ['4 ms', '8 ms', '10 ms', '6 ms'];
          const latency = latencies[index] || '5 ms';

          return (
            <g key={`service-${service.id}`}>
              {/* Service logo/icon box */}
              <rect
                x={x - 50}
                y={y - 30}
                width="100"
                height="60"
                fill="white"
                stroke="#e5e7eb"
                strokeWidth="2"
                rx="12"
                style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }}
              />

              {/* Logo area */}
              <rect
                x={x - 35}
                y={y - 20}
                width="70"
                height="25"
                fill={service.color}
                fillOpacity="0.1"
                stroke={service.color}
                strokeWidth="1"
                rx="6"
              />

              {/* Service name */}
              <text
                x={x}
                y={y - 5}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#374151"
              >
                {service.name === 'Critical Applications' ? 'Critical' : service.name}
              </text>

              {service.name === 'Critical Applications' && (
                <text
                  x={x}
                  y={y + 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#374151"
                >
                  Applications
                </text>
              )}

              {/* Service type */}
              <text
                x={x}
                y={y + (service.name === 'Critical Applications' ? 20 : 8)}
                textAnchor="middle"
                fontSize="9"
                fill="#6b7280"
              >
                {service.type === 'AWS' ? 'Direct Connect' :
                 service.type === 'Azure' ? 'ExpressRoute' :
                 service.type === 'GCP' ? 'Interconnect' :
                 service.type}
              </text>

              {/* Connection line to Megaport center */}
              <path
                d={`M ${x} ${y + 30} Q ${x} ${y + 80} ${centerX} ${centerY - ringRadius - 20}`}
                stroke="#9ca3af"
                strokeWidth="2"
                fill="none"
                strokeDasharray="4,4"
                opacity="0.6"
              />

              {/* Latency label */}
              <rect
                x={x - 15}
                y={y + 55}
                width="30"
                height="16"
                fill="white"
                stroke="#e5e7eb"
                strokeWidth="1"
                rx="8"
                opacity="0.95"
              />
              <text
                x={x}
                y={y + 65}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="#374151"
              >
                {latency}
              </text>
            </g>
          );
        })}

        {/* Central Megaport Cloud - Single circle with logo only */}
        <g>
          {/* Central Megaport circle - single circle design like reference */}
          <circle
            cx={centerX * dimensions.width}
            cy={centerY * dimensions.height}
            r="60"
            fill="white"
            stroke="#f97316"
            strokeWidth="4"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
          />

          {/* Megaport Logo */}
          <text
            x={centerX * dimensions.width}
            y={centerY * dimensions.height - 8}
            textAnchor="middle"
            fontSize="16"
            fontWeight="bold"
            fill="#f97316"
          >
            Megaport
          </text>

          <text
            x={centerX * dimensions.width}
            y={centerY * dimensions.height + 10}
            textAnchor="middle"
            fontSize="12"
            fontWeight="500"
            fill="#f97316"
          >
            NaaS Platform
          </text>
        </g>
        
        {/* Megaport POPs positioned in ring formation like reference image */}
        {ringPOPs.map((pop, index) => {
          const popX = pop.x * dimensions.width;
          const popY = pop.y * dimensions.height;
          const isCustomPOP = pop.isCustom;

          return (
            <g key={`cloud-pop-${pop.id}`}>
              {/* Connection line from POP to Megaport circle edge */}
              <line
                x1={popX}
                y1={popY}
                x2={centerX * dimensions.width + (popX - centerX * dimensions.width) * (60/Math.sqrt(Math.pow(popX - centerX * dimensions.width, 2) + Math.pow(popY - centerY * dimensions.height, 2)))} 
                y2={centerY * dimensions.height + (popY - centerY * dimensions.height) * (60/Math.sqrt(Math.pow(popX - centerX * dimensions.width, 2) + Math.pow(popY - centerY * dimensions.height, 2)))}
                stroke="#f97316"
                strokeWidth="3"
                opacity="0.6"
              />

              {/* POP Node - Orange circles attached to cloud */}
              <circle
                cx={popX}
                cy={popY}
                r="25"
                fill={isCustomPOP ? "#10b981" : "#f97316"}
                stroke="white"
                strokeWidth="3"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))' }}
              />

              {/* Inner circle */}
              <circle
                cx={popX}
                cy={popY}
                r="15"
                fill="white"
                opacity="0.9"
              />

              {/* POP name */}
              <text
                x={popX}
                y={popY + 45}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={isCustomPOP ? "#10b981" : "#f97316"}
              >
                {pop.name}
              </text>

              {/* Remove button for custom POPs */}
              {isCustomPOP && (
                <g>
                  <circle
                    cx={popX + 20}
                    cy={popY - 20}
                    r="8"
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRemoveMegaportOnramp(pop.id)}
                  />
                  <text
                    x={popX + 20}
                    y={popY - 16}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill="white"
                    style={{ pointerEvents: 'none' }}
                  >
                    ×
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Inter-POP connections within the Megaport ring */}
        {ringPOPs.length > 1 && ringPOPs.map((pop, index) => {
          const nextIndex = (index + 1) % ringPOPs.length;
          const currentPOP = ringPOPs[index];
          const nextPOP = ringPOPs[nextIndex];
          
          const popX1 = currentPOP.x * dimensions.width;
          const popY1 = currentPOP.y * dimensions.height;
          const popX2 = nextPOP.x * dimensions.width;
          const popY2 = nextPOP.y * dimensions.height;

          const midX = (popX1 + popX2) / 2;
          const midY = (popY1 + popY2) / 2;
          const connectionLatency = ['2 ms', '4 ms', '6 ms', '3 ms'][index % 4];

          return (
            <g key={`inter-pop-${index}-${nextIndex}`}>
              {/* POP-to-POP connection through cloud */}
              <line
                x1={popX1}
                y1={popY1}
                x2={popX2}
                y2={popY2}
                stroke="#f97316"
                strokeWidth="3"
                opacity="0.4"
                strokeDasharray="5,5"
              />

              {/* Connection latency label */}
              <rect
                x={midX - 15}
                y={midY - 6}
                width="30"
                height="12"
                fill="white"
                stroke="#f97316"
                strokeWidth="1"
                rx="6"
                opacity="0.9"
              />
              <text
                x={midX}
                y={midY + 2}
                textAnchor="middle"
                fontSize="8"
                fontWeight="600"
                fill="#f97316"
              >
                {connectionLatency}
              </text>
            </g>
          );
        })}

        {/* Customer Sites - positioned below POPs with better distribution */}
        {sites.map((site, siteIndex) => {
          // Calculate proper site positioning to ensure all are visible
          const maxSitesPerRow = Math.floor(dimensions.width / 140); // Minimum 140px per site
          const totalRows = Math.ceil(sites.length / maxSitesPerRow);
          const currentRow = Math.floor(siteIndex / maxSitesPerRow);
          const positionInRow = siteIndex % maxSitesPerRow;
          const sitesInThisRow = Math.min(maxSitesPerRow, sites.length - currentRow * maxSitesPerRow);
          
          // Calculate spacing to center sites in the row
          const rowStartX = (dimensions.width - (sitesInThisRow - 1) * 140) / 2;
          const siteX = rowStartX + positionInRow * 140;
          const siteY = customerY + currentRow * 50; // Multiple rows if needed

          // Find nearest POP for connection
          let nearestPOP = null;
          let minDistance = Infinity;

          if (ringPOPs.length > 0) {
            ringPOPs.forEach(pop => {
              const popX = pop.x * dimensions.width;
              const popY = pop.y * dimensions.height;
              const distance = Math.sqrt(Math.pow(siteX - popX, 2) + Math.pow(siteY - popY, 2));

              if (distance < minDistance) {
                minDistance = distance;
                nearestPOP = { x: popX, y: popY };
              }
            });
          }

          return (
            <g key={`site-${site.id}`}>
              {/* Connection line to nearest POP */}
              {nearestPOP && (
                <line
                  x1={siteX}
                  y1={siteY - 20}
                  x2={nearestPOP.x}
                  y2={nearestPOP.y + 25}
                  stroke="#9ca3af"
                  strokeWidth="2"
                  opacity="0.7"
                  strokeDasharray="3,3"
                />
              )}

              {/* Site building icon - matching reference style */}
              <g>
                <rect
                  x={siteX - 18}
                  y={siteY - 30}
                  width="36"
                  height="30"
                  fill="#f3f4f6"
                  stroke="#6b7280"
                  strokeWidth="2"
                  rx="3"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                />

                {/* Building details */}
                <rect x={siteX - 12} y={siteY - 25} width="3" height="3" fill="#3b82f6" opacity="0.7" />
                <rect x={siteX - 6} y={siteY - 25} width="3" height="3" fill="#3b82f6" opacity="0.7" />
                <rect x={siteX + 2} y={siteY - 25} width="3" height="3" fill="#3b82f6" opacity="0.7" />
                <rect x={siteX + 8} y={siteY - 25} width="3" height="3" fill="#3b82f6" opacity="0.7" />
              </g>

              {/* Site name */}
              <text
                x={siteX}
                y={siteY + 15}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="#374151"
              >
                {site.name.length > 12 ? site.name.substring(0, 10) + '..' : site.name}
              </text>
            </g>
          );
        })}

        {/* Title */}
        <text
          x={dimensions.width / 2}
          y={30}
          textAnchor="middle"
          fontSize="24"
          fontWeight="bold"
          fill="#374151"
        >
          Optimized with Megaport
        </text>
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
          {/* Site background - prettier with gradient */}
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

          {/* Inner circle for better icon contrast */}
          <circle
            cx={position.x}
            cy={position.y}
            r={isSelected ? "18" : "14"}
            fill="rgba(255,255,255,0.2)"
            opacity="0.8"
          />

          {/* Site icon - larger and better positioned */}
          <foreignObject
            x={position.x - (isSelected ? 12 : 10)}
            y={position.y - (isSelected ? 12 : 10)}
            width={isSelected ? "24" : "20"}
            height={isSelected ? "24" : "20"}
            style={{ pointerEvents: 'none' }}
          >
            <IconComponent className={`${isSelected ? 'w-6 h-6' : 'w-5 h-5'} text-white drop-shadow-sm`} />
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
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
            cursor: isPanning ? 'grabbing' : 'grab',
            willChange: isPanning || isDragging || isDraggingCloud ? 'transform' : 'auto',
            backfaceVisibility: 'hidden'
          }}
          onMouseDown={handleCanvasMouseDown}
        >
          {/* Background rectangle for panning */}
          <rect
            id="svg-background"
            width={dimensions.width}
            height={dimensions.height}
            fill="transparent"
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          />

          {/* Render in layers: connections first, then clouds, then optimization, then sites, then heat map */}
          {!isOptimizationView && renderConnections()}
          {!isOptimizationView && renderClouds()}
          {isOptimizationView && renderFlattenedOptimization()}
          {!isOptimizationView && renderSites()}
          {renderHeatMapOverlay()}
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
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
          <div className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">View Controls</span>
              <button
                onClick={() => togglePanel('viewControls')}
                className="p-1 hover:bg-gray-100 rounded"
                data-testid="button-toggle-view-controls"
              >
                {collapsedPanels.viewControls ? 
                  <ChevronDown className="h-3 w-3 text-gray-500" /> : 
                  <ChevronUp className="h-3 w-3 text-gray-500" />
                }
              </button>
            </div>
          </div>
          {!collapsedPanels.viewControls && (
            <div className="px-3 pb-3 space-y-2">
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
          )}
        </div>

        {/* Connection Visibility Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
          <div className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Connection Lines</span>
              <button
                onClick={() => togglePanel('connectionLines')}
                className="p-1 hover:bg-gray-100 rounded"
                data-testid="button-toggle-connection-lines"
              >
                {collapsedPanels.connectionLines ? 
                  <ChevronDown className="h-3 w-3 text-gray-500" /> : 
                  <ChevronUp className="h-3 w-3 text-gray-500" />
                }
              </button>
            </div>
          </div>
          {!collapsedPanels.connectionLines && (
            <div className="px-3 pb-3 space-y-2">
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
          )}
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
                // Apply default optimization settings immediately
                const defaultAnswers = {
                  primaryGoal: 'cost-optimization',
                  budget: 'moderate',
                  redundancy: 'high',
                  latency: 'moderate',
                  compliance: 'standard',
                  timeline: 'planned'
                };
                setOptimizationAnswers(defaultAnswers);
                setIsOptimizationView(true);
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
        {isOptimizationView && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Optimization Profile</span>
                <button
                  onClick={() => togglePanel('optimization')}
                  className="p-1 hover:bg-gray-100 rounded"
                  data-testid="button-toggle-optimization"
                >
                  {collapsedPanels.optimization ? 
                    <ChevronDown className="h-3 w-3 text-gray-500" /> : 
                    <ChevronUp className="h-3 w-3 text-gray-500" />
                  }
                </button>
              </div>
            </div>
            {!collapsedPanels.optimization && (
              <div className="px-4 pb-4 space-y-3">
              <div className="space-y-1 text-xs text-gray-600">
                <div>Goal: <span className="font-medium">{optimizationAnswers?.primaryGoal?.replace('-', ' ')}</span></div>
                <div>Budget: <span className="font-medium">{optimizationAnswers?.budget}</span></div>
                <div>Redundancy: <span className="font-medium">{optimizationAnswers?.redundancy}</span></div>
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
                  <span>Short distance (More POPs)</span>
                  <span>Long distance (Fewer POPs)</span>
                </div>
                <div className="text-xs text-gray-600">
                  {(() => {
                    let sitesInRange = 0;
                    sites.forEach(site => {
                      const minDistance = Math.min(...megaportPOPs.map(pop => 
                        calculateRealDistance(site.name, pop)
                      ));
                      if (minDistance <= popDistanceThreshold) {
                        sitesInRange++;
                      }
                    });
                    return `${sitesInRange} of ${sites.length} sites within range`;
                  })()}
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

              {/* Selected POPs Summary */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <span className="text-xs font-medium text-gray-700">Selected Megaport POPs</span>
                {(() => {
                  const optimalPOPs = getOptimalMegaportPOPs();
                  return (
                    <div className="text-xs text-gray-600 space-y-1">
                      <div><strong>Active POPs ({optimalPOPs.length}):</strong></div>
                      {optimalPOPs.map(pop => (
                        <div key={pop.id}>• {pop.name} {pop.isCustom ? '(Custom)' : ''}</div>
                      ))}
                    </div>
                  );
                })()}
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
            )}
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

        {/* Add Megaport Onramp Button */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200">
          <Button
            size="sm"
            onClick={() => setShowAddOnrampDialog(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            data-testid="button-add-megaport-onramp"
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
            {isOptimizationView ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-600">• Solid lines = Redundant connections</p>
                <p className="text-xs text-gray-600">• Dashed lines = Single connections</p>
                <p className="text-xs text-gray-600">• Orange POPs = Standard Megaport locations</p>
                <p className="text-xs text-gray-600">• Green POPs = Custom onramp locations</p>
                <p className="text-xs text-gray-600">• Click × to remove custom onramps</p>
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

      {/* Add Megaport Onramp Dialog */}
      <AddMegaportOnrampDialog
        open={showAddOnrampDialog}
        onClose={() => setShowAddOnrampDialog(false)}
        onAdd={handleAddMegaportOnramp}
      />

    </div>
  );
}