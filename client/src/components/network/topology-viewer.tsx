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

import { Site } from '@shared/schema';
import amazonAwsLocal from '@/assets/logos/amazonaws.svg';

// Use the exact same Site interface as the parent component
interface Connection {
  type: string;
  bandwidth: string;
  provider?: string;
  pointToPointEndpoint?: string;
  customProvider?: string;
}

// Local interface for sites with connections (extends the shared Site type)
interface SiteWithConnections extends Site {
  connections: Connection[];
}

// Interface for Megaport POP objects
interface MegaportPOP {
  id: string;
  name: string;
  x: number;
  y: number;
  isCustom?: boolean;
}

interface TopologyViewerProps {
  sites: SiteWithConnections[];
  selectedSite?: SiteWithConnections | null;
  onSelectSite?: (site: SiteWithConnections | null) => void;
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
  const lastUpdateTime = useRef<number>(0);
  const [editingSite, setEditingSite] = useState<SiteWithConnections | null>(null);
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

  // Fallback map for provider logos when CDN is unavailable
  const [logoFallbackMap, setLogoFallbackMap] = useState<Record<string, boolean>>({});

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
  // Driving distance cache (miles) for siteId|popId
  const [distanceCache, setDistanceCache] = useState<Record<string, number>>({});
  const inFlightDistance = useRef<Set<string>>(new Set());
  const fetchDrivingDistance = useCallback(async (fromAddress: string, toAddress: string, cacheKey: string) => {
    try {
      if (!fromAddress || !toAddress) return;
      const fa = fromAddress.trim();
      const tooGeneric = fa.length < 8 || ['united states', 'usa', 'us'].includes(fa.toLowerCase());
      if (tooGeneric) {
        console.warn('[distance] skipped fetch: fromAddress too generic', { cacheKey, fromAddress });
        return;
      }
      if (inFlightDistance.current.has(cacheKey)) return;
      inFlightDistance.current.add(cacheKey);
      const url = `/api/distance?from=${encodeURIComponent(fromAddress)}&to=${encodeURIComponent(toAddress)}`;
      console.debug('[distance] fetching', { cacheKey, fromAddress, toAddress });
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn('Driving distance API not available:', resp.status);
        inFlightDistance.current.delete(cacheKey);
        return;
      }
      const data = await resp.json();
      const miles = Number(data?.miles);
      if (Number.isFinite(miles) && miles > 0) {
        console.debug('[distance] cached', { cacheKey, miles, provider: data?.provider, cached: data?.cached });
        setDistanceCache(prev => ({ ...prev, [cacheKey]: miles }));
      }
      inFlightDistance.current.delete(cacheKey);
    } catch (e) {
      console.warn('Driving distance fetch failed:', (e as any)?.message || e);
      inFlightDistance.current.delete(cacheKey);
    }
  }, [isOptimizationView, sites, popDistanceThreshold, distanceCache, optimizationAnswers]);
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
      id: 'megapop-las', 
      name: 'Las Vegas', 
      address: '302 E Carson Ave, Las Vegas, NV 89101',
      x: 0.18, y: 0.65, active: false, isCustom: false 
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
      id: 'megapop-den', 
      name: 'Denver', 
      address: '910 15th St, Denver, CO 80202',
      x: 0.42, y: 0.6, active: false, isCustom: false 
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
  const calculateDistance = useCallback((site: Site, pop: { id: string; x: number; y: number }) => {
    if (!site.coordinates) return Infinity;

    // Convert normalized coordinates to approximate miles
    // US is roughly 2,800 miles wide and 1,600 miles tall
    const dx = Math.abs(site.coordinates.x - pop.x) * 2800;
    const dy = Math.abs(site.coordinates.y - pop.y) * 1600;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate real geographic distance based on site location name and POP city
  const calculateRealDistance = useCallback((site: Site, pop: { id: string; x: number; y: number }) => {
    // 0) Use cached driving distance if available
    const cacheKey = `${site.id}|${pop.id}`;
    const cached = distanceCache[cacheKey];
    if (typeof cached === 'number' && isFinite(cached)) {
      console.debug('[distance] using cached', { cacheKey, miles: cached });
      return cached;
    }

    // Comprehensive geographic distance mapping - updated with Seattle POP
    const cityDistances: Record<string, Record<string, number>> = {
      // West Coast locations
      'san francisco': { 'megapop-sfo': 0, 'megapop-lax': 350, 'megapop-sea': 800, 'megapop-chi': 1850, 'megapop-dal': 1450, 'megapop-hou': 1650, 'megapop-mia': 2580, 'megapop-res': 2850, 'megapop-nyc': 2900 },
      'los angeles': { 'megapop-lax': 0, 'megapop-sfo': 350, 'megapop-sea': 1150, 'megapop-chi': 1750, 'megapop-dal': 1240, 'megapop-hou': 1370, 'megapop-mia': 2340, 'megapop-res': 2300, 'megapop-nyc': 2450 },
      'seattle': { 'megapop-sea': 0, 'megapop-sfo': 800, 'megapop-lax': 1150, 'megapop-chi': 1740, 'megapop-dal': 1650, 'megapop-hou': 1890, 'megapop-mia': 2735, 'megapop-res': 2330, 'megapop-nyc': 2400 },
      'portland': { 'megapop-sea': 170, 'megapop-sfo': 800, 'megapop-lax': 1150, 'megapop-chi': 1750, 'megapop-dal': 1620, 'megapop-hou': 1850, 'megapop-mia': 2700, 'megapop-res': 2350, 'megapop-nyc': 2450 },
      'las vegas': { 'megapop-las': 18, 'megapop-lax': 270, 'megapop-sfo': 570, 'megapop-sea': 870, 'megapop-chi': 1520, 'megapop-dal': 1050, 'megapop-hou': 1230, 'megapop-mia': 2030, 'megapop-res': 2100, 'megapop-nyc': 2230 },
      'phoenix': { 'megapop-lax': 370, 'megapop-sfo': 650, 'megapop-sea': 1120, 'megapop-chi': 1440, 'megapop-dal': 890, 'megapop-hou': 1020, 'megapop-mia': 1890, 'megapop-res': 2000, 'megapop-nyc': 2140 },

      // Central locations  
      'denver': { 'megapop-den': 1, 'megapop-chi': 920, 'megapop-dal': 660, 'megapop-hou': 880, 'megapop-sfo': 950, 'megapop-lax': 830, 'megapop-sea': 1320, 'megapop-mia': 1730, 'megapop-res': 1500, 'megapop-nyc': 1630 },
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
    const location = site.name.toLowerCase();
    let closestCity = '';

    // Direct city name matches first
    Object.keys(cityDistances).forEach(city => {
      if (location.includes(city)) {
        closestCity = city;
      }
    });

    // Enhanced pattern matching for complex location names - prioritize Seattle match
    if (!closestCity) {
      if (location.includes('seattle') || location.includes('tech hub') || (location.includes('tech') && location.includes('hub')) || location.includes('washington state')) {
        closestCity = 'seattle';
      } else if (location.includes('portland') || location.includes('green tech') || location.includes('green') || location.includes('oregon')) {
        closestCity = 'portland';
      } else if (location.includes('san francisco') || location.includes('west coast data center') || location.includes('bay area') || location.includes('innovation lab')) {
        closestCity = 'san francisco';
      } else if (location.includes('los angeles') || location.includes('la ')) {
        closestCity = 'los angeles';
      } else if (location.includes('las vegas') || location.includes('vegas') || location.includes('customer center')) {
        closestCity = 'las vegas';
      } else if (location.includes('phoenix') || location.includes('southwest')) {
        closestCity = 'phoenix';
      } else if (location.includes('denver') || location.includes('mountain region') || location.includes('colorado')) {
        closestCity = 'denver';
      } else if ((location.includes('banker') || location.includes('bankers') || location.includes("banker’s") || location.includes("banker's")) && (location.includes('hq') || location.includes('headquarters'))) {
        // Project-specific HQ heuristic -> Denver
        closestCity = 'denver';
      } else if (location.includes('chicago') || location.includes('illinois') || location.includes('branch office')) {
        closestCity = 'chicago';
      } else if (location.includes('detroit') || location.includes('manufacturing') || location.includes('michigan')) {
        closestCity = 'chicago'; // Detroit is closest to Chicago POP
      } else if (location.includes('dallas') || location.includes('dfw') || location.includes('regional hub')) {
        closestCity = 'dallas';
      } else if (location.includes('houston') || location.includes('energy')) {
        closestCity = 'houston';
      } else if (location.includes('minneapolis') || location.includes('north central') || location.includes('minnesota')) {
        closestCity = 'minneapolis';
      } else if (location.includes('salt lake') || location.includes('mountain west') || location.includes('utah')) {
        closestCity = 'salt lake city';
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
        // Regional fallbacks - more specific, prioritize Seattle for Pacific Northwest
        if (location.includes('washington state') || location.includes('washington') || location.includes('pacific northwest') || location.includes('northwest')) {
          closestCity = 'seattle';
        } else if (location.includes('oregon') || location.includes('portland')) {
          closestCity = 'portland';
        } else if (location.includes('california') || location.includes('west coast')) {
          closestCity = 'san francisco';
        } else if (location.includes('texas') || location.includes('uptown')) {
          closestCity = 'dallas';
        } else if (location.includes('florida')) {
          closestCity = 'miami';
        } else if (location.includes('midwest') || location.includes('michigan') || location.includes('wisconsin') || location.includes('indiana') || location.includes('ohio')) {
          closestCity = 'chicago';
        } else if (location.includes('virginia') || location.includes('washington dc') || location.includes('reston') || location.includes('maryland')) {
          closestCity = 'new york';
        } else if (location.includes('nevada') || location.includes('arizona') || location.includes('new mexico')) {
          closestCity = 'phoenix';
        } else if (location.includes('kansas') || location.includes('missouri') || location.includes('iowa') || location.includes('nebraska')) {
          closestCity = 'chicago';
        }
      }
    }

    console.log(`Location "${site.name}" mapped to city: "${closestCity}"`);

    if (closestCity && cityDistances[closestCity]) {
      const distance = cityDistances[closestCity][pop.id];
      if (distance !== undefined) {
        const adjusted = distance === 0 ? 1 : distance; // small intra-city baseline; real driving miles will replace
        console.log(`Real distance from ${closestCity} to ${pop.id}: ${adjusted} miles (raw: ${distance})`);

        // 1) Fire-and-forget driving distance fetch if we have addresses
        try {
          const parts = [
            (site as any).streetAddress,
            (site as any).city,
            (site as any).state,
            (site as any).postalCode,
          ].filter(Boolean);
          // Only include country if we also have at least one specific component
          if (parts.length > 0) {
            const country = (site as any).country || 'United States';
            parts.push(country);
          }
          let fromAddress = parts.join(', ');
          if (!fromAddress) {
            // Fallbacks when structured address is missing
            // Prefer a city/state inferred address so it's not too generic
            const cityToState: Record<string, string> = {
              'seattle': 'WA',
              'portland': 'OR',
              'san francisco': 'CA',
              'los angeles': 'CA',
              'las vegas': 'NV',
              'phoenix': 'AZ',
              'denver': 'CO',
              'chicago': 'IL',
              'dallas': 'TX',
              'houston': 'TX',
              'new york': 'NY',
              'miami': 'FL',
              'atlanta': 'GA',
              'salt lake city': 'UT'
            };
            if (closestCity) {
              const state = cityToState[closestCity] || 'USA';
              fromAddress = `${closestCity.replace(/\b\w/g, c => c.toUpperCase())}, ${state}`;
            } else {
              fromAddress = (site as any).location || site.name || '';
            }
          }

          const popEntry = (megaportPOPs as any[]).find(p => p.id === pop.id);
          const toAddress = popEntry?.address as string | undefined;

          if (fromAddress && toAddress) {
            console.debug('[distance] trigger fetch', { cacheKey, fromAddress, toAddress });
            fetchDrivingDistance(fromAddress, toAddress, cacheKey);
          }
        } catch {}

        return adjusted;
      }
    }

    // Default fallback distance
    console.log(`Using fallback distance for unmapped location: ${site.name}`);
    return 3000;
  }, [distanceCache, megaportPOPs, fetchDrivingDistance]);

  // Prefetch driving distances for visible site→POP pairs in optimized view (deduped)
  const prefetchedKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isOptimizationView) return;
    const optimal = getOptimalMegaportPOPs();
    if (!optimal.length) return;

    const prefetched = prefetchedKeysRef.current;

    sites.forEach(site => {
      optimal.forEach(pop => {
        const cacheKey = `${site.id}|${pop.id}`;
        if (prefetched.has(cacheKey) || typeof distanceCache[cacheKey] === 'number') return;

        try {
          const parts = [
            (site as any).streetAddress,
            (site as any).city,
            (site as any).state,
            (site as any).postalCode,
          ].filter(Boolean);
          if (parts.length > 0) {
            const country = (site as any).country || 'United States';
            parts.push(country);
          }
          let fromAddress = parts.join(', ');
          if (!fromAddress) fromAddress = (site as any).location || site.name || '';

          const popEntry = (megaportPOPs as any[]).find(p => p.id === pop.id);
          const toAddress = popEntry?.address as string | undefined;
          if (fromAddress && toAddress) {
            prefetched.add(cacheKey);
            console.debug('[distance] prefetch', { cacheKey, fromAddress, toAddress });
            fetchDrivingDistance(fromAddress, toAddress, cacheKey);
          }
        } catch {}
      });
    });
  }, [isOptimizationView, sites, popDistanceThreshold, fetchDrivingDistance]);

  // Check if Data Center has Megaport onramp capability
  const hasDataCenterOnramp = useCallback((site: Site) => {
    if (site.category !== 'Data Center') return false;

    // Major metros with known Megaport presence
    const megaportMetros = ['new york', 'san francisco', 'chicago', 'dallas', 'atlanta', 'seattle', 'miami'];
    const isInMegaportMetro = megaportMetros.some(metro => 
      site.name.toLowerCase().includes(metro) || 
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

    // Step 0: Respect predefined POPs from inventory when present
    // If any Site has nearestMegaportPop or megaportRegion defined, prioritize using those POPs
    const predefinedPOPIds = new Set<string>();
    const resolvePopIdsFromText = (raw: string): string[] => {
      if (!raw) return [];
      const text = raw.toLowerCase();
      const matches: string[] = [];
      // 1) Exact id match
      megaportPOPs.forEach(pop => {
        if (text.includes(pop.id.toLowerCase())) matches.push(pop.id);
      });
      if (matches.length) return matches;
      // 2) Name substring match
      megaportPOPs.forEach(pop => {
        if (text.includes(pop.name.toLowerCase()) || pop.name.toLowerCase().includes(text)) {
          matches.push(pop.id);
        }
      });
      if (matches.length) return matches;
      // 3) Keyword fallback
      const keywords: Array<{ k: RegExp; id: string }> = [
        { k: /(seattle|\bsea\b)/, id: 'megapop-sea' },
        { k: /(san\s*francisco|\bsfo\b|bay)/, id: 'megapop-sfo' },
        { k: /(los\s*angeles|\bla\b|lax)/, id: 'megapop-lax' },
        { k: /(las\s*vegas|lasvegas|\blas\b|\bveg\b)/, id: 'megapop-las' },
        { k: /(dallas|\bdal\b|dfw)/, id: 'megapop-dal' },
        { k: /(houston|\bhou\b)/, id: 'megapop-hou' },
        { k: /(chicago|\bchi\b)/, id: 'megapop-chi' },
        { k: /(denver|\bden\b)/, id: 'megapop-den' },
        { k: /(reston|ashburn|virginia|\bva\b)/, id: 'megapop-res' },
        { k: /(new\s*york|\bnyc\b)/, id: 'megapop-nyc' },
        { k: /(miami|\bmia\b)/, id: 'megapop-mia' }
      ];
      keywords.forEach(({ k, id }) => {
        if (k.test(text)) matches.push(id);
      });
      return matches;
    };

    sites.forEach(site => {
      const np = site.nearestMegaportPop?.toString() || '';
      const region = site.megaportRegion?.toString() || '';
      resolvePopIdsFromText(np).forEach(id => predefinedPOPIds.add(id));
      resolvePopIdsFromText(region).forEach(id => predefinedPOPIds.add(id));
    });

    // Also infer from site names when inventory fields are absent or unhelpful
    sites.forEach(site => {
      const original = site.name || '';
      const name = original.toLowerCase();
      if (name.includes('las vegas') || name.includes('vegas')) {
        console.log(`[Inference] Site name matched Las Vegas: ${original}`);
        predefinedPOPIds.add('megapop-las');
      }
      // Heuristics for Denver / HQ
      const isHq = name.includes('hq') || name.includes('headquarters');
      const bankerLike = name.includes('banker') || name.includes("bankers") || name.includes("banker’s") || name.includes("banker's");
      if (name.includes('denver') || name.includes('front range') || (bankerLike && isHq)) {
        console.log(`[Inference] Site name matched Denver/HQ: ${original}`);
        predefinedPOPIds.add('megapop-den');
      }
    });

    if (predefinedPOPIds.size > 0) {
      const predefinedPOPs = megaportPOPs
        .filter(pop => predefinedPOPIds.has(pop.id))
        .map(pop => ({ ...pop, active: true }))
        .sort((a, b) => a.x - b.x);

      console.log('Using predefined POPs from inventory:', Array.from(predefinedPOPIds.values()));

      // If exactly two POPs are predefined, return them directly for the ring view
      // If more than two, still respect them; else fall back to greedy selection
      if (predefinedPOPs.length >= 2) {
        return predefinedPOPs;
      }
      // If only one predefined, we'll include it but continue with greedy to add coverage
      // selected later by the greedy algorithm below
    }

    const siteLocations = sites.filter(site => site.coordinates);
    console.log(`Found ${siteLocations.length} sites with coordinates:`, siteLocations.map(s => s.name));
    if (siteLocations.length === 0) {
      // No site coordinates available; if we had 1 predefined POP, still show it to render ring/POP
      if (predefinedPOPIds.size === 1) {
        const single = megaportPOPs
          .filter(pop => predefinedPOPIds.has(pop.id))
          .map(pop => ({ ...pop, active: true }))
          .sort((a, b) => a.x - b.x);
        return single;
      }
      return [];
    }

    // Step 1: Find the minimum set of POPs that can serve all sites within the distance threshold
    const siteToNearestPOPs = new Map<string, Array<{ popId: string; distance: number }>>();

    // For each site, find all POPs within the distance threshold, sorted by distance
    siteLocations.forEach((site: any) => {
      const nearbyPOPs: Array<{ popId: string; distance: number }> = [];

      megaportPOPs.forEach(pop => {
        const distance = calculateRealDistance(site, pop);
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
        // No POPs can cover remaining sites within threshold - use closest POP for each
        console.log(`No POPs within threshold for ${uncoveredSites.size} remaining sites, using closest available`);
        uncoveredSites.forEach(siteId => {
          const site = siteLocations.find(s => s.id === siteId);
          if (!site) return;

          let closestPOP: any = null;
          let minDistance = Infinity;

          megaportPOPs.forEach(pop => {
            const distance = calculateRealDistance(site, pop);
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
        const distance = calculateRealDistance(site, pop);
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

  // Calculate ring positions for selected Megaport POPs (positioned west to east like geographic layout)
  const getMegaportRingPositions = useCallback(() => {
    const optimalPOPs = getOptimalMegaportPOPs();
    if (optimalPOPs.length === 0) return [];

    // Sort POPs by their original x coordinate (west to east) to maintain geographic ordering
    const sortedPOPs = optimalPOPs.sort((a, b) => a.x - b.x);

    const centerX = 0.5;
    const centerY = 0.35; // Match the naasY position exactly

    // Define oval ring dimensions in normalized coordinates
    const ovalRadiusX = 0.22; // Slightly smaller horizontal radius
    const ovalRadiusY = 0.12; // Smaller vertical radius to fit better

    return sortedPOPs.map((pop, index) => {
      const totalPOPs = sortedPOPs.length;

      if (totalPOPs === 1) {
        // Single POP positioned to the right
        return {
          ...pop,
          x: centerX + 0.2,
          y: centerY
        };
      } else if (totalPOPs === 2) {
        // Two POPs positioned left and right
        const x = centerX + (index === 0 ? -ovalRadiusX : ovalRadiusX);
        return {
          ...pop,
          x: Math.max(0.1, Math.min(0.9, x)),
          y: centerY
        };
      } else {
        // Multiple POPs: distribute along the oval perimeter in geographic order (west to east)
        // Start from leftmost position and go clockwise around the top half of the oval
        let angle;

        if (totalPOPs <= 6) {
          // For fewer POPs, distribute along the oval perimeter more naturally
          // Start from left (west) and move to right (east) along the oval curve
          const angleRange = Math.PI; // Use top half of oval (180 degrees)
          angle = Math.PI - (index * angleRange) / (totalPOPs - 1); // Start from left (180°) to right (0°)
        } else {
          // For many POPs, use full oval
          angle = (index * 2 * Math.PI) / totalPOPs - Math.PI/2; // Start from top
        }

        const x = centerX + Math.cos(angle) * ovalRadiusX;
        const y = centerY + Math.sin(angle) * ovalRadiusY;

        return {
          ...pop,
          x: Math.max(0.05, Math.min(0.95, x)),
          y: Math.max(0.15, Math.min(0.75, y))
        };
      }
    });
  }, [getOptimalMegaportPOPs]);

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
      let minDistance = calculateRealDistance(site, nearestPOP);

      for (const pop of availablePOPs) {
        const distance = calculateRealDistance(site, pop);
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
  }, [isOptimizationView, sites, megaportPOPs, popDistanceThreshold, dimensions, calculateRealDistance, sitePositions]);

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

  // Initialize and update site positions - different logic for optimized vs normal view
  useEffect(() => {
    console.log('TopologyViewer useEffect - sites:', sites.length, 'dimensions:', dimensions);
    if (!sites.length) {
      console.log('Skipping position update - no sites');
      return;
    }

    console.log('TopologyViewer received sites:', sites.length, sites);
    console.log('Current view:', isOptimizationView ? 'Optimization' : 'Normal');

    const newPositions: Record<string, { x: number; y: number }> = {};
    const effWidth = dimensions.width === 0 ? 1400 : dimensions.width;
    const effHeight = dimensions.height === 0 ? 900 : dimensions.height;

    if (!isOptimizationView) {
      // Normal view: use existing coordinates or default positioning
      sites.forEach((site, index) => {
        if (site.coordinates) {
          // Use existing coordinates (converted from normalized to pixels)
          newPositions[site.id] = {
            x: site.coordinates.x * effWidth,
            y: site.coordinates.y * effHeight
          };
        } else {
          // Default circular arrangement for new sites
          const angle = (index / sites.length) * 2 * Math.PI;
          const radius = Math.min(effWidth, effHeight) * 0.3;
          const centerX = effWidth * 0.5;
          const centerY = effHeight * 0.5;

          newPositions[site.id] = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
          };
        }
      });

      // Update site positions for normal view
      setSitePositions(prev => {
        const hasChanged = Object.keys(newPositions).some(id =>
          !prev[id] ||
          Math.abs(prev[id].x - newPositions[id].x) > 5 ||
          Math.abs(prev[id].y - newPositions[id].y) > 5
        );
        if (hasChanged) {
          console.log('Updating site positions (normal view)');
          return { ...prev, ...newPositions };
        }
        return prev;
      });
    } else {
      // Optimization view: use geographic positioning
      // Enhanced geographic mapping for realistic US positioning with improved west-to-east ordering
      const getGeographicPosition = (site: Site): { lon: number; lat: number; region: string } => {
        const name = site.name.toLowerCase();

        // Real US city coordinates for accurate positioning
        const cityCoordinates: Record<string, { lon: number; lat: number; region: string }> = {
          // Far West Coast
          'seattle': { lon: -122.3, lat: 47.6, region: 'Pacific Northwest' },
          'portland': { lon: -122.7, lat: 45.5, region: 'Pacific Northwest' },

          // West Coast
          'san francisco': { lon: -122.4, lat: 37.8, region: 'California' },
          'los angeles': { lon: -118.2, lat: 34.1, region: 'California' },

          // Southwest
          'las vegas': { lon: -115.1, lat: 36.2, region: 'Southwest' },
          'phoenix': { lon: -112.1, lat: 33.4, region: 'Southwest' },
          'salt lake city': { lon: -111.9, lat: 40.8, region: 'Mountain West' },
          'denver': { lon: -105.0, lat: 39.7, region: 'Mountain' },

          // South Central
          'dallas': { lon: -96.8, lat: 32.8, region: 'South Central' },
          'houston': { lon: -95.4, lat: 29.8, region: 'South Central' },

          // Midwest
          'chicago': { lon: -87.6, lat: 41.9, region: 'Midwest' },
          'detroit': { lon: -83.0, lat: 42.3, region: 'Midwest' },
          'minneapolis': { lon: -93.3, lat: 44.9, region: 'Midwest' },

          // Southeast
          'atlanta': { lon: -84.4, lat: 33.7, region: 'Southeast' },
          'miami': { lon: -80.2, lat: 25.8, region: 'Southeast' },
          'nashville': { lon: -86.8, lat: 36.2, region: 'Southeast' },
          'raleigh': { lon: -78.6, lat: 35.8, region: 'Southeast' },
          'orlando': { lon: -81.4, lat: 28.5, region: 'Southeast' },

          // East Coast
          'new york': { lon: -74.0, lat: 40.7, region: 'Northeast' },
          'boston': { lon: -71.1, lat: 42.4, region: 'Northeast' }
        };

        // Enhanced city detection with special cases
        for (const [city, coords] of Object.entries(cityCoordinates)) {
          if (name.includes(city)) {
            console.log(`Direct city match: ${site.name} -> ${city} (${coords.lon}, ${coords.lat})`);
            return coords;
          }
        }

        // Enhanced pattern matching for complex site names
        if (name.includes('tech hub') || (name.includes('seattle') && name.includes('tech'))) {
          console.log(`Pattern match: ${site.name} -> Seattle Tech Hub`);
          return cityCoordinates['seattle'];
        }
        if (name.includes('innovation') || name.includes('west coast data center') || name.includes('west coast')) {
          console.log(`Pattern match: ${site.name} -> San Francisco`);
          return cityCoordinates['san francisco'];
        }
        if (name.includes('customer center') || name.includes('vegas') || name.includes('las vegas')) {
          console.log(`Pattern match: ${site.name} -> Las Vegas`);
          return cityCoordinates['las vegas'];
        }
        if (name.includes('energy') || (name.includes('houston') && name.includes('energy'))) {
          console.log(`Pattern match: ${site.name} -> Houston`);
          return cityCoordinates['houston'];
        }
        if (name.includes('manufacturing') || (name.includes('detroit') && name.includes('manufacturing'))) {
          console.log(`Pattern match: ${site.name} -> Detroit`);
          return cityCoordinates['detroit'];
        }
        if (name.includes('headquarters') || name.includes('hq')) {
          console.log(`Pattern match: ${site.name} -> New York HQ`);
          return cityCoordinates['new york'];
        }
        if (name.includes('green tech') || name.includes('green')) {
          console.log(`Pattern match: ${site.name} -> Portland Green Tech`);
          return cityCoordinates['portland'];
        }
        if (name.includes('mountain west') || name.includes('mountain')) {
          console.log(`Pattern match: ${site.name} -> Salt Lake City`);
          return cityCoordinates['salt lake city'];
        }
        if (name.includes('southwest') && !name.includes('phoenix')) {
          console.log(`Pattern match: ${site.name} -> Phoenix Southwest`);
          return cityCoordinates['phoenix'];
        }
        if (name.includes('tourism') || name.includes('orlando')) {
          console.log(`Pattern match: ${site.name} -> Orlando`);
          return cityCoordinates['orlando'];
        }
        if (name.includes('research triangle') || name.includes('triangle')) {
          console.log(`Pattern match: ${site.name} -> Raleigh`);
          return cityCoordinates['raleigh'];
        }
        if (name.includes('north central') || name.includes('minneapolis')) {
          console.log(`Pattern match: ${site.name} -> Minneapolis`);
          return cityCoordinates['minneapolis'];
        }
        if (name.includes('music city') || name.includes('nashville')) {
          console.log(`Pattern match: ${site.name} -> Nashville/Atlanta`);
          return cityCoordinates['atlanta']; // Nashville uses Atlanta region
        }
        if (name.includes('east coast hub') || name.includes('boston')) {
          console.log(`Pattern match: ${site.name} -> Boston/New York`);
          return cityCoordinates['new york']; // Boston uses NY region
        }

        // Regional fallbacks if no city match
        if (name.includes('west') || name.includes('pacific') || name.includes('california')) {
          console.log(`Regional fallback: ${site.name} -> West Coast`);
          return { lon: -120, lat: 37, region: 'West' };
        }
        if (name.includes('east') || name.includes('atlantic') || name.includes('northeast')) {
          console.log(`Regional fallback: ${site.name} -> East Coast`);
          return { lon: -78, lat: 36, region: 'East' };
        }
        if (name.includes('texas') || name.includes('south central')) {
          console.log(`Regional fallback: ${site.name} -> Texas`);
          return { lon: -97, lat: 31, region: 'Texas' };
        }
        if (name.includes('midwest') || name.includes('central') || name.includes('great lakes')) {
          console.log(`Regional fallback: ${site.name} -> Midwest`);
          return { lon: -88, lat: 42, region: 'Midwest' };
        }

        // Default to central US for unmapped locations
        console.log(`Default coordinates: ${site.name} -> Central US`);
        return { lon: -98, lat: 39, region: 'Central' };
      };

      // Map sites to geographic positions
      const sitesWithCoords = sites.map(site => ({
        ...site,
        geo: getGeographicPosition(site)
      }));

      // Sort sites west to east by longitude for proper left-to-right ordering
      const sortedSites = sitesWithCoords.sort((a, b) => {
        const lonDiff = a.geo.lon - b.geo.lon;
        // If longitudes are very close, use latitude as secondary sort (north to south)
        if (Math.abs(lonDiff) < 0.5) {
          return b.geo.lat - a.geo.lat; // North to south (higher lat first)
        }
        return lonDiff; // West to east (lower lon first)
      });

      console.log('Geographic site order (west to east):', sortedSites.map(s => 
        `${s.name} (${s.geo.lon.toFixed(1)}°, ${s.geo.lat.toFixed(1)}°)`
      ));

      // Avoid conflicts: this effect handles normal view only
      if (isOptimizationView) {
        return;
      }

      // Calculate canvas bounds and spacing
      const padding = 100;
      const usableWidth = effWidth - (padding * 2);
      const baseY = effHeight * 0.72; // Position sites below Megaport ring
      const minSpacing = 140; // Minimum space between sites

      // Find longitude bounds for proportional distribution
      const lonMin = Math.min(...sortedSites.map(s => s.geo.lon));
      const lonMax = Math.max(...sortedSites.map(s => s.geo.lon));
      const lonRange = lonMax - lonMin;

      console.log(`Geographic bounds: ${lonMin.toFixed(1)}° to ${lonMax.toFixed(1)}° (${lonRange.toFixed(1)}° range)`);

      // Create geographic lanes based on longitude bands
      const laneCount = Math.min(4, Math.max(1, Math.ceil(sortedSites.length / 4))); // 1-4 lanes
      const laneHeight = 60; // Vertical spacing between lanes

      // Distribute sites into lanes based on longitude
      const lanes: Array<{ sites: any[]; minLon: number; maxLon: number }> = [];
      for (let i = 0; i < laneCount; i++) {
        const laneMinLon = lonMin + (i * lonRange / laneCount);
        const laneMaxLon = lonMin + ((i + 1) * lonRange / laneCount);

        lanes.push({
          sites: [],
          minLon: laneMinLon,
          maxLon: laneMaxLon
        });
      }

      // Assign sites to lanes
      sortedSites.forEach(site => {
        let assignedLane = 0;
        for (let i = 0; i < lanes.length; i++) {
          if (site.geo.lon >= lanes[i].minLon && 
              (site.geo.lon < lanes[i].maxLon || i === lanes.length - 1)) {
            assignedLane = i;
            break;
          }
        }
        lanes[assignedLane].sites.push(site);
      });

      // Position sites within each lane
      lanes.forEach((lane, laneIndex) => {
        if (lane.sites.length === 0) return;

        const laneY = baseY + (laneIndex * laneHeight);
        const laneSites = lane.sites.sort((a, b) => a.geo.lon - b.geo.lon); // Sort within lane

        if (laneSites.length === 1) {
          // Single site: position based on its longitude within the total range
          const site = laneSites[0];
          const lonPercent = lonRange > 0 ? (site.geo.lon - lonMin) / lonRange : 0.5;
          const siteX = padding + (lonPercent * usableWidth);

          newPositions[site.id] = {
            x: Math.max(padding + 50, Math.min(effWidth - padding - 50, siteX)),
            y: laneY
          };
        } else {
          // Multiple sites: distribute them across the lane width with minimum spacing
          const laneWidth = usableWidth;
          const totalMinSpacing = minSpacing * (laneSites.length - 1);

          if (totalMinSpacing <= laneWidth) {
            // Sufficient space: distribute evenly with extra spacing
            const extraSpace = laneWidth - totalMinSpacing;
            const spacing = minSpacing + (extraSpace / Math.max(1, laneSites.length - 1));

            laneSites.forEach((site, siteIndex) => {
              const siteX = padding + (siteIndex * spacing);
              newPositions[site.id] = {
                x: Math.max(padding + 50, Math.min(effWidth - padding - 50, siteX)),
                y: laneY
              };
            });
          } else {
            // Tight spacing: compress but maintain minimum separation
            const compressedSpacing = laneWidth / Math.max(1, laneSites.length - 1);

            laneSites.forEach((site, siteIndex) => {
              const siteX = padding + (siteIndex * compressedSpacing);
              newPositions[site.id] = {
                x: Math.max(padding + 50, Math.min(effWidth - padding - 50, siteX)),
                y: laneY
              };
            });
          }
        }
      });

      // Apply force-directed positioning to reduce overlaps while maintaining geographic order
      const maxIterations = 20;
      const forceStrength = 3;

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        let hasChanges = false;
        const positionArray = Object.entries(newPositions);

        for (let i = 0; i < positionArray.length; i++) {
          const [siteId1, pos1] = positionArray[i];
          let forceX = 0;
          let forceY = 0;

          for (let j = 0; j < positionArray.length; j++) {
            if (i === j) continue;

            const [siteId2, pos2] = positionArray[j];
            const dx = pos2.x - pos1.x;
            const dy = pos2.y - pos1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minSpacing && distance > 0) {
              // Calculate repulsion force
              const repulsion = (minSpacing - distance) / distance * forceStrength;
              forceX -= dx * repulsion;
              forceY -= dy * repulsion;
              hasChanges = true;
            }
          }

          // Apply forces with bounds checking
          if (Math.abs(forceX) > 0.1 || Math.abs(forceY) > 0.1) {
            const newX = Math.max(padding + 50, Math.min(effWidth - padding - 50, pos1.x + forceX));
            const newY = Math.max(baseY, Math.min(effHeight - 100, pos1.y + forceY * 0.3)); // Reduce vertical movement

            newPositions[siteId1] = { x: newX, y: newY };
          }
        }

        if (!hasChanges) break; // Converged
      }

      // Final adjustment pass to ensure no overlaps
      const finalPositions = Object.entries(newPositions);
      for (let i = 0; i < finalPositions.length; i++) {
        for (let j = i + 1; j < finalPositions.length; j++) {
          const [siteId1, pos1] = finalPositions[i];
          const [siteId2, pos2] = finalPositions[j];

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < minSpacing) {
            // Move the rightmost site further right to maintain west-to-east order
            const rightSite = pos2.x > pos1.x ? siteId2 : siteId1;
            const rightPos = pos2.x > pos1.x ? pos2 : pos1;

            const adjustment = (minSpacing - distance) / 2 + 10;
            rightPos.x += adjustment;

            // Keep within bounds
            rightPos.x = Math.max(padding + 50, Math.min(effWidth - padding - 50, rightPos.x));

            console.log(`Final adjustment: moved ${sites.find(s => s.id === rightSite)?.name} to avoid overlap`);
          }
        }
      }

      // Update site positions for optimization view
      setSitePositions(prev => {
        // Only update if positions actually changed
        const hasChanged = Object.keys(newPositions).some(id => 
          !prev[id] || 
          Math.abs(prev[id].x - newPositions[id].x) > 5 || 
          Math.abs(prev[id].y - newPositions[id].y) > 5
        );

        if (hasChanged) {
          console.log('Updating site positions (normal view)');
          return { ...prev, ...newPositions };
        }
        return prev;
      });

    }
  }, [
    sites, 
    isOptimizationView, 
    dimensions.width, 
    dimensions.height,
    popDistanceThreshold
  ]); // Simplified dependency array to prevent infinite loops

  // Initialize WAN cloud positions and visibility
  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {};

    [...baseWanClouds, ...customClouds].forEach(cloud => {
      // Convert normalized coordinates to pixels for initial positions
      positions[cloud.id] = {
        x: cloud.x * dimensions.width,
        y: cloud.y * dimensions.height
      };
    });

    // Only update if positions actually changed to avoid render loops
    setCloudPositions(prev => {
      const sameKeys = Object.keys(positions).length === Object.keys(prev).length;
      let changed = !sameKeys;
      if (!changed) {
        for (const id of Object.keys(positions)) {
          const p = prev[id];
          const n = positions[id];
          if (!p || Math.abs(p.x - n.x) > 0.5 || Math.abs(p.y - n.y) > 0.5) {
            changed = true;
            break;
          }
        }
      }
      return changed ? positions : prev;
    });

    // Initialize visibility keys only for clouds that don't exist yet
    setCloudVisibility(prev => {
      const updates: Record<string, boolean> = {};
      [...baseWanClouds, ...customClouds].forEach(cloud => {
        if (!(cloud.id in prev)) updates[cloud.id] = true;
      });
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [dimensions.width, dimensions.height, customClouds.length]);

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

  // Drag handlers for sites - only enabled in normal view
  const handleMouseDown = useCallback((siteId: string) => (e: React.MouseEvent) => {
    if (isOptimizationView) return; // Disable dragging in optimization view

    e.preventDefault();
    e.stopPropagation();

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
  }, [sitePositions, panOffset, zoom, isOptimizationView]);

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
    } else if (isDragging && !isOptimizationView) {
      // Only allow dragging in normal view
      const targetX = adjustedX - dragOffset.x;
      const targetY = adjustedY - dragOffset.y;

      // Constrain to canvas boundaries
      const constrainedX = Math.max(60, Math.min(dimensions.width - 60, targetX));
      const constrainedY = Math.max(60, Math.min(dimensions.height - 60, targetY));

      // Throttle updates to prevent excessive re-renders
      const now = Date.now();
      if (!lastUpdateTime.current || now - lastUpdateTime.current > 16) { // ~60fps
        lastUpdateTime.current = now;

        // Update site position
        setSitePositions(prev => ({
          ...prev,
          [isDragging]: { x: constrainedX, y: constrainedY }
        }));

        // Update parent component with normalized coordinates
        onUpdateSiteCoordinates(isDragging, {
          x: constrainedX / dimensions.width,
          y: constrainedY / dimensions.height
        });

        setHasUnsavedChanges(true);
      }
    } else if (isDraggingCloud && !isOptimizationView) {
      // Only allow cloud dragging in normal view
      const targetX = adjustedX - dragOffset.x;
      const targetY = adjustedY - dragOffset.y;

      const constrainedX = Math.max(60, Math.min(dimensions.width - 60, targetX));
      const constrainedY = Math.max(60, Math.min(dimensions.height - 60, targetY));

      // Throttle updates
      const now = Date.now();
      if (!lastUpdateTime.current || now - lastUpdateTime.current > 16) {
        lastUpdateTime.current = now;

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
    }
  }, [isDragging, isDraggingCloud, isPanning, lastPanPoint, panOffset, zoom, dimensions, onUpdateSiteCoordinates, onUpdateWANCloud, dragOffset, updatePanPosition, isOptimizationView]);

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
    setEditingSite({ ...site, connections: [] });
  }, []);

  const handleSaveSite = useCallback((siteId: string | null, updates: Partial<Site>) => {
    // In this viewer, we only edit existing sites; however, SiteEditDialog allows null for creation.
    // Gracefully handle null by falling back to the currently editing site's ID.
    const effectiveId = siteId ?? editingSite?.id;
    if (effectiveId && onUpdateSite) {
      onUpdateSite(effectiveId, updates);
      setHasUnsavedChanges(true);
    }
  }, [onUpdateSite, editingSite]);

  const handleDeleteSite = useCallback((siteId: string) => {
    if (onDeleteSite) {
      onDeleteSite(siteId);
    }
    setEditingSite(null);
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
          // Require a valid cloud, not hidden, and not explicitly disabled
          if (!targetCloud) return;
          if (hiddenClouds.has(targetCloud.id)) return;
          if ((cloudVisibility[targetCloud.id] ?? true) === false) return;

          // Check if this specific cloud is visible (default to true if undefined)
          // (kept above)

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
              key={`${connectionId}-${connection.bandwidth}`}
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
              <g key={`label-${connectionId}-${connection.bandwidth}`}>
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

  // Render a provider-specific logo inside a cloud circle (no text label)
  const renderCloudLogo = (cloud: WANCloud, x: number, y: number, iconSize: number) => {
    const key = (cloud.type || cloud.name || '').toLowerCase();

    // Map provider keywords to Simple Icons slugs
    const toSlug = () => {
      const key = (cloud.type || cloud.name || '').toLowerCase();
      if (key.includes('amazon web services') || key === 'amazon' || key.includes('aws')) return 'amazonaws';
      if (key.includes('google') || key.includes('gcp')) return 'googlecloud';
      if (key.includes('azure') || key.includes('microsoft')) return 'microsoftazure';
      if (key.includes('microsoft 365') || key.includes('office 365') || key.includes('o365')) return 'microsoftoffice';
      if (key.includes('gcp') || key.includes('google cloud')) return 'googlecloud';
      if (key.includes('google workspace') || key.includes('workspace') || key.includes('g suite')) return 'googleworkspace';
      if (key.includes('okta')) return 'okta';
      if (key.includes('slack')) return 'slack';
      if (key.includes('box')) return 'box';
      if (key.includes('dropbox')) return 'dropbox';
      if (key.includes('atlassian') || key.includes('jira') || key.includes('confluence')) return 'atlassian';
      if (key.includes('github')) return 'github';
      if (key.includes('webex') || key.includes('cisco')) return 'webex';
      if (key.includes('zscaler')) return 'zscaler';
      if (key.includes('cloudflare')) return 'cloudflare';
      if (key.includes('palo alto') || key.includes('paloalto') || key.includes('prisma')) return 'paloaltosoftware';
      if (key.includes('salesforce')) return 'salesforce';
      if (key.includes('servicenow')) return 'servicenow';
      if (key.includes('zoom')) return 'zoom';
      if (key.includes('oracle')) return 'oracle';
      if (key.includes('sap')) return 'sap';
      if (key.includes('snowflake')) return 'snowflake';
      if (key.includes('workday')) return 'workday';
      if (key.includes('zendesk')) return 'zendesk';
      if (key.includes('datadog')) return 'datadog';
      if (key.includes('new relic') || key.includes('newrelic')) return 'newrelic';
      // Broad provider keywords
      if (key.includes('google')) return 'googlecloud';
      if (key.includes('microsoft')) return 'microsoftazure';
      return null;
    };

    const slug = toSlug();
    const fallback = logoFallbackMap[cloud.id] === true;

    // Choose icon color: AWS looks best as dark monochrome; others use the cloud color
    const lowerKey = (cloud.type || cloud.name || '').toLowerCase();
    const isAWS = lowerKey.includes('amazon web services') || lowerKey === 'amazon' || lowerKey.includes('aws');
    const iconHex = isAWS ? '111111' : (cloud.color?.replace('#', '') || '000000');

    return (
      <g>
        {/* If we have a slug and not in fallback, render the CDN icon */}

        {/* Overlay official icon if available and not in fallback */}
        {slug && !fallback && (
          <>
            {/* Primary attempt */}
            <image
              href={`https://cdn.simpleicons.org/${slug}/${iconHex}`}
              xlinkHref={`https://cdn.simpleicons.org/${slug}/${iconHex}`}
              x={x - Math.floor(iconSize)/2}
              y={y - Math.floor(iconSize)/2}
              width={Math.floor(iconSize)}
              height={Math.floor(iconSize)}
              preserveAspectRatio="xMidYMid meet"
              style={{ pointerEvents: 'none' }}
              onError={(e) => {
                // If AWS slug alias might work, try it once before falling back to text
                if (isAWS) {
                  const img = e.currentTarget as SVGImageElement;
                  const triedAlias = img.getAttribute('data-tried-alias') === '1';
                  if (!triedAlias) {
                    img.setAttribute('data-tried-alias', '1');
                    img.setAttribute('href', `https://cdn.simpleicons.org/amazonaws/${iconHex}`);
                    img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `https://cdn.simpleicons.org/amazonaws/${iconHex}`);
                    return;
                  }
                }
                setLogoFallbackMap(prev => ({ ...prev, [cloud.id]: true }));
              }}
            />
          </>
        )}

        {/* Local fallback for AWS when CDN is blocked/unavailable */}
        {isAWS && fallback && (
          <image
            href={amazonAwsLocal as unknown as string}
            xlinkHref={amazonAwsLocal as unknown as string}
            x={x - Math.floor(iconSize)/2}
            y={y - Math.floor(iconSize)/2}
            width={Math.floor(iconSize)}
            height={Math.floor(iconSize)}
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Generic fallback when no slug and not AWS */}
        {!slug && !isAWS && (
          <foreignObject
            x={x - iconSize/2}
            y={y - iconSize/2}
            width={iconSize}
            height={iconSize}
            style={{ pointerEvents: 'none' }}
          >
            <Cloud className={`w-full h-full drop-shadow-sm`} color={cloud.color} />
          </foreignObject>
        )}
      </g>
    );
  };

  // Render WAN clouds
  const renderClouds = () => {
    return getActiveClouds().map(cloud => {
      if (hiddenClouds.has(cloud.id) || (cloudVisibility[cloud.id] ?? true) === false) return null;
      const x = cloud.x * dimensions.width;
      const y = cloud.y * dimensions.height;

      // Different sizes for different cloud types
      const radius = (cloud.type === 'Internet' || cloud.type === 'MPLS') ? 64 : 45;
      // Enlarge icons for Cloud App nodes
      const iconSize = (cloud.type === 'Internet' || cloud.type === 'MPLS') ? 32 : 28;

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

          {/* Provider logo/mark */}
          {renderCloudLogo(cloud, x, y, iconSize)}

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

  // Regional clustering function for intelligent geographic grouping
  const getRegionalClusters = useCallback((sites: SiteWithConnections[]) => {
    // Define geographic regions with their longitude ranges and state mappings
    const regions = {
      "Pacific Northwest": { lonRange: [-125, -116.5], states: ["WA", "OR"], priority: 1 },
      "California": { lonRange: [-125, -114], states: ["CA"], priority: 2 },
      "Southwest": { lonRange: [-119, -103], states: ["AZ", "NV", "UT", "NM"], priority: 3 },
      "Mountain West": { lonRange: [-115, -102], states: ["CO", "WY", "MT", "ID"], priority: 4 },
      "Texas": { lonRange: [-107, -93.5], states: ["TX"], priority: 5 },
      "Midwest": { lonRange: [-104, -80], states: ["IL", "IN", "OH", "MI", "WI", "MN", "IA", "MO", "KS", "NE", "ND", "SD"], priority: 6 },
      "Southeast": { lonRange: [-92, -75], states: ["FL", "GA", "AL", "MS", "LA", "TN", "KY", "SC", "NC"], priority: 7 },
      "Northeast": { lonRange: [-80, -66], states: ["NY", "NJ", "PA", "CT", "RI", "MA", "VT", "NH", "ME", "MD", "DE", "DC"], priority: 8 }
    };

    // Extract approximate longitude from site names using geographic mapping
    const getApproxLongitude = (site: SiteWithConnections): number => {
      const name = site.name.toLowerCase();
      const cityLongitudes: Record<string, number> = {
        'seattle': -122.3, 'portland': -122.7, 'san francisco': -122.4, 'los angeles': -118.2,
        'las vegas': -115.1, 'phoenix': -112.1, 'denver': -105.0, 'salt lake': -111.9,
        'dallas': -96.8, 'houston': -95.4, 'chicago': -87.6, 'detroit': -83.0,
        'minneapolis': -93.3, 'atlanta': -84.4, 'miami': -80.2, 'new york': -74.0,
        'boston': -71.1, 'nashville': -86.8, 'raleigh': -78.6
      };

      for (const [city, lon] of Object.entries(cityLongitudes)) {
        if (name.includes(city)) return lon;
      }

      // Regional fallbacks
      if (name.includes('west coast') || name.includes('california')) return -120;
      if (name.includes('texas') || name.includes('southwest')) return -98;
      if (name.includes('midwest') || name.includes('central')) return -90;
      if (name.includes('east coast') || name.includes('northeast')) return -75;
      if (name.includes('southeast') || name.includes('south')) return -82;

      return -98; // Default central US
    };

    // Extract state from site name
    const getStateFromName = (site: SiteWithConnections): string => {
      const name = site.name.toLowerCase();
      const stateMapping: Record<string, string> = {
        'seattle': 'WA', 'portland': 'OR', 'san francisco': 'CA', 'los angeles': 'CA',
        'las vegas': 'NV', 'phoenix': 'AZ', 'denver': 'CO', 'salt lake': 'UT',
        'dallas': 'TX', 'houston': 'TX', 'chicago': 'IL', 'detroit': 'MI',
        'minneapolis': 'MN', 'atlanta': 'GA', 'miami': 'FL', 'new york': 'NY',
        'boston': 'MA', 'nashville': 'TN', 'raleigh': 'NC'
      };

      for (const [city, state] of Object.entries(stateMapping)) {
        if (name.includes(city)) return state;
      }
      return '';
    };

    // Group sites by state first
    const sitesByState: Record<string, SiteWithConnections[]> = {};
    sites.forEach(site => {
      const state = getStateFromName(site);
      const lon = getApproxLongitude(site);
      (site as any).longitude = lon;
      (site as any).state = state;

      if (!sitesByState[state]) sitesByState[state] = [];
      sitesByState[state].push(site);
    });

    // Assign states to regions
    const regionCounts: Record<string, SiteWithConnections[]> = {};
    Object.entries(sitesByState).forEach(([state, stateSites]) => {
      let assignedRegion = '';

      for (const [regionName, regionData] of Object.entries(regions)) {
        if (regionData.states.includes(state)) {
          assignedRegion = regionName;
          break;
        }
      }

      if (assignedRegion) {
        if (!regionCounts[assignedRegion]) regionCounts[assignedRegion] = [];
        regionCounts[assignedRegion].push(...stateSites);
      }
    });

    // Apply intelligent naming rules
    const clusters: { regionName: string; sites: SiteWithConnections[]; avgLon: number }[] = [];

    Object.entries(regionCounts).forEach(([region, regionSites]) => {
      if (regionSites.length === 0) return;

      // Calculate average longitude for west-to-east ordering
      const avgLon = regionSites.reduce((sum, site) => sum + ((site as any).longitude || -98), 0) / regionSites.length;

      // Apply intelligent naming based on site distribution
      let finalName = region;

      // Special case: If all sites are in one state, use state name
      const uniqueStates = Array.from(new Set(regionSites.map(s => (s as any).state).filter(Boolean)));
      if (uniqueStates.length === 1 && uniqueStates[0]) {
        const stateNames: Record<string, string> = {
          "CA": "California", "TX": "Texas", "NY": "New York", "FL": "Florida",
          "WA": "Washington", "OR": "Oregon", "IL": "Illinois", "OH": "Ohio"
        };
        finalName = stateNames[uniqueStates[0]] || uniqueStates[0];
      }

      // Special case: Multiple related regions
      if (region === "California" && regionCounts["Pacific Northwest"]?.length > 0) {
        if (finalName === "California") finalName = "West Coast";
      }

      clusters.push({
        regionName: finalName,
        sites: regionSites.sort((a, b) => ((a as any).longitude || -98) - ((b as any).longitude || -98)), // Sort west to east within region
        avgLon
      });
    });

    // Sort clusters by average longitude (west to east)
    return clusters.sort((a, b) => a.avgLon - b.avgLon);
  }, []);

  // Initialize optimization layout positions with proper geographic spread like US map
  useEffect(() => {
    if (!isOptimizationView || !sites.length || dimensions.width === 0) return;

    const newPositions: Record<string, { x: number; y: number }> = {};

    // Enhanced geographic mapping for realistic US positioning
    const getGeographicPosition = (site: Site): { lon: number; lat: number; region: string } => {
      const name = site.name.toLowerCase();

      // Real US city coordinates for accurate positioning
      const cityCoordinates: Record<string, { lon: number; lat: number; region: string }> = {
        // Far West Coast
        'seattle': { lon: -122.3, lat: 47.6, region: 'Pacific Northwest' },
        'portland': { lon: -122.7, lat: 45.5, region: 'Pacific Northwest' },

        // West Coast
        'san francisco': { lon: -122.4, lat: 37.8, region: 'California' },
        'los angeles': { lon: -118.2, lat: 34.1, region: 'California' },

        // Southwest
        'las vegas': { lon: -115.1, lat: 36.2, region: 'Southwest' },
        'phoenix': { lon: -112.1, lat: 33.4, region: 'Southwest' },
        'salt lake city': { lon: -111.9, lat: 40.8, region: 'Mountain West' },
        'denver': { lon: -105.0, lat: 39.7, region: 'Mountain' },

        // South Central
        'dallas': { lon: -96.8, lat: 32.8, region: 'South Central' },
        'houston': { lon: -95.4, lat: 29.8, region: 'South Central' },

        // Midwest
        'chicago': { lon: -87.6, lat: 41.9, region: 'Midwest' },
        'detroit': { lon: -83.0, lat: 42.3, region: 'Midwest' },
        'minneapolis': { lon: -93.3, lat: 44.9, region: 'Midwest' },

        // Southeast
        'atlanta': { lon: -84.4, lat: 33.7, region: 'Southeast' },
        'miami': { lon: -80.2, lat: 25.8, region: 'Southeast' },
        'nashville': { lon: -86.8, lat: 36.2, region: 'Southeast' },
        'raleigh': { lon: -78.6, lat: 35.8, region: 'Southeast' },
        'orlando': { lon: -81.4, lat: 28.5, region: 'Southeast' },

        // East Coast
        'new york': { lon: -74.0, lat: 40.7, region: 'Northeast' },
        'boston': { lon: -71.1, lat: 42.4, region: 'Northeast' }
      };

      // Enhanced city detection with special cases
      for (const [city, coords] of Object.entries(cityCoordinates)) {
        if (name.includes(city)) {
          console.log(`Direct city match: ${site.name} -> ${city} (${coords.lon}, ${coords.lat})`);
          return coords;
        }
      }

      // Enhanced pattern matching for complex site names
      if (name.includes('tech hub') || (name.includes('seattle') && name.includes('tech'))) {
        console.log(`Pattern match: ${site.name} -> Seattle Tech Hub`);
        return cityCoordinates['seattle'];
      }
      if (name.includes('innovation') || name.includes('west coast data center') || name.includes('west coast')) {
        console.log(`Pattern match: ${site.name} -> San Francisco`);
        return cityCoordinates['san francisco'];
      }
      if (name.includes('customer center') || name.includes('vegas') || name.includes('las vegas')) {
        console.log(`Pattern match: ${site.name} -> Las Vegas`);
        return cityCoordinates['las vegas'];
      }
      if (name.includes('energy') || (name.includes('houston') && name.includes('energy'))) {
        console.log(`Pattern match: ${site.name} -> Houston`);
        return cityCoordinates['houston'];
      }
      if (name.includes('manufacturing') || (name.includes('detroit') && name.includes('manufacturing'))) {
        console.log(`Pattern match: ${site.name} -> Detroit`);
        return cityCoordinates['detroit'];
      }
      if (name.includes('headquarters') || name.includes('hq')) {
        console.log(`Pattern match: ${site.name} -> New York HQ`);
        return cityCoordinates['new york'];
      }
      if (name.includes('green tech') || name.includes('green')) {
        console.log(`Pattern match: ${site.name} -> Portland Green Tech`);
        return cityCoordinates['portland'];
      }
      if (name.includes('mountain west') || name.includes('mountain')) {
        console.log(`Pattern match: ${site.name} -> Salt Lake City`);
        return cityCoordinates['salt lake city'];
      }
      if (name.includes('southwest') && !name.includes('phoenix')) {
        console.log(`Pattern match: ${site.name} -> Phoenix Southwest`);
        return cityCoordinates['phoenix'];
      }
      if (name.includes('tourism') || name.includes('orlando')) {
        console.log(`Pattern match: ${site.name} -> Orlando`);
        return cityCoordinates['orlando'];
      }
      if (name.includes('research triangle') || name.includes('triangle')) {
        console.log(`Pattern match: ${site.name} -> Raleigh`);
        return cityCoordinates['raleigh'];
      }
      if (name.includes('north central') || name.includes('minneapolis')) {
        console.log(`Pattern match: ${site.name} -> Minneapolis`);
        return cityCoordinates['minneapolis'];
      }
      if (name.includes('music city') || name.includes('nashville')) {
        console.log(`Pattern match: ${site.name} -> Nashville/Atlanta`);
        return cityCoordinates['atlanta']; // Nashville uses Atlanta region
      }
      if (name.includes('east coast hub') || name.includes('boston')) {
        console.log(`Pattern match: ${site.name} -> Boston/New York`);
        return cityCoordinates['new york']; // Boston uses NY region
      }

      // Regional fallbacks if no city match
      if (name.includes('west') || name.includes('pacific') || name.includes('california')) {
        console.log(`Regional fallback: ${site.name} -> West Coast`);
        return { lon: -120, lat: 37, region: 'West' };
      }
      if (name.includes('east') || name.includes('atlantic') || name.includes('northeast')) {
        console.log(`Regional fallback: ${site.name} -> East Coast`);
        return { lon: -78, lat: 36, region: 'East' };
      }
      if (name.includes('texas') || name.includes('south central')) {
        console.log(`Regional fallback: ${site.name} -> Texas`);
        return { lon: -97, lat: 31, region: 'Texas' };
      }
      if (name.includes('midwest') || name.includes('central') || name.includes('great lakes')) {
        console.log(`Regional fallback: ${site.name} -> Midwest`);
        return { lon: -88, lat: 42, region: 'Midwest' };
      }

      // Default to central US for unmapped locations
      console.log(`Default coordinates: ${site.name} -> Central US`);
      return { lon: -98, lat: 39, region: 'Central' };
    };

    // Map sites to geographic positions
    const sitesWithCoords = sites.map(site => ({
      ...site,
      geo: getGeographicPosition(site)
    }));

    // Sort sites west to east by longitude for proper left-to-right ordering
    const sortedSites = sitesWithCoords.sort((a, b) => {
      const lonDiff = a.geo.lon - b.geo.lon;
      // If longitudes are very close, use latitude as secondary sort (north to south)
      if (Math.abs(lonDiff) < 0.5) {
        return b.geo.lat - a.geo.lat; // North to south (higher lat first)
      }
      return lonDiff; // West to east (lower lon first)
    });

    console.log('Geographic site order (west to east):', sortedSites.map(s => 
      `${s.name} (${s.geo.lon.toFixed(1)}°, ${s.geo.lat.toFixed(1)}°)`
    ));

    // Calculate canvas bounds and spacing
    const padding = 100;
    const usableWidth = dimensions.width - (padding * 2);
    const baseY = dimensions.height * 0.72; // Position sites below Megaport ring
    const minSpacing = 180; // Minimum horizontal space between sites to avoid label/icon overlap

    // Find longitude/latitude bounds for proportional distribution
    const lonMin = Math.min(...sortedSites.map(s => s.geo.lon));
    const lonMax = Math.max(...sortedSites.map(s => s.geo.lon));
    const lonRange = lonMax - lonMin;
    const latMin = Math.min(...sortedSites.map(s => s.geo.lat));
    const latMax = Math.max(...sortedSites.map(s => s.geo.lat));
    const latRange = latMax - latMin;

    console.log(`Geographic bounds: ${lonMin.toFixed(1)}° to ${lonMax.toFixed(1)}° (${lonRange.toFixed(1)}° range)`);

    // Create geographic lanes based on latitude bands (north to south) for vertical separation
    const laneCount = Math.min(4, Math.max(1, Math.ceil(sortedSites.length / 5))); // 1-4 lanes
    const laneHeight = 120; // Increased vertical spacing between lanes

    // Distribute sites into lanes based on latitude
    const lanes: Array<{ sites: any[]; minLat: number; maxLat: number }> = [];
    for (let i = 0; i < laneCount; i++) {
      const laneMaxLat = latMax - (i * (latRange / laneCount)); // higher lat first
      const laneMinLat = latMax - ((i + 1) * (latRange / laneCount));
      lanes.push({
        sites: [],
        minLat: laneMinLat,
        maxLat: laneMaxLat
      });
    }

    // Assign sites to lanes by latitude
    sortedSites.forEach(site => {
      let assignedLane = lanes.length - 1; // default to last if all else fails
      for (let i = 0; i < lanes.length; i++) {
        if ((site.geo.lat <= lanes[i].maxLat || i === 0) &&
            (site.geo.lat > lanes[i].minLat || i === lanes.length - 1)) {
          assignedLane = i;
          break;
        }
      }
      lanes[assignedLane].sites.push(site);
    });

    // Position sites within each latitude lane
    lanes.forEach((lane, laneIndex) => {
      if (lane.sites.length === 0) return;

      const laneY = baseY + (laneIndex * laneHeight);
      const laneSites = lane.sites.sort((a, b) => a.geo.lon - b.geo.lon); // West→East in lane

      // Compute desired X from longitude proportion
      // Compute desired X from longitude proportion with small jitter for near-identical longitudes
      const nearLonEpsilon = 0.25; // degrees
      const desiredXs = laneSites.map((site, idx) => {
        const lonPercent = lonRange > 0 ? (site.geo.lon - lonMin) / lonRange : 0.5;
        let baseX = padding + (lonPercent * usableWidth);
        // If neighbor longitude is very close, apply slight alternating jitter to reduce stacking
        const prev = laneSites[idx - 1];
        if (prev && Math.abs(site.geo.lon - prev.geo.lon) < nearLonEpsilon) {
          const jitter = (idx % 2 === 0 ? -1 : 1) * Math.min(20, minSpacing * 0.2);
          baseX += jitter;
        }
        return baseX;
      });

      // Greedy collision resolution to enforce minSpacing while preserving order
      const resolvedXs: number[] = [];

      // Also compute a latitude-based Y offset within the lane to reduce vertical stacking
      const laneLatRange = Math.max(0.0001, (lane.maxLat - lane.minLat));
      const yBand = laneHeight * 0.8; // use larger portion of lane for vertical dispersion
      const minVerticalSpacing = 48;  // increased minimal vertical spacing to avoid label overlap
      const resolvedYs: number[] = [];

      laneSites.forEach((site, idx) => {
        // Resolve X with horizontal spacing
        const targetX = Math.max(padding + 50, Math.min(dimensions.width - padding - 50, desiredXs[idx]));
        if (idx === 0) {
          resolvedXs[idx] = targetX;
        } else {
          resolvedXs[idx] = Math.max(targetX, resolvedXs[idx - 1] + minSpacing);
          // Clamp at right edge; if we clamp, slightly squeeze previous ones backward if needed
          if (resolvedXs[idx] > dimensions.width - padding - 50) {
            let overflow = resolvedXs[idx] - (dimensions.width - padding - 50);
            for (let j = idx; j >= 0 && overflow > 0; j--) {
              const minAllowed = (j === 0) ? (padding + 50) : (resolvedXs[j - 1] + minSpacing);
              const canShift = Math.max(0, resolvedXs[j] - minAllowed);
              const shift = Math.min(canShift, overflow);
              resolvedXs[j] -= shift;
              overflow -= shift;
            }
            resolvedXs[idx] = Math.min(resolvedXs[idx], dimensions.width - padding - 50);
          }
        }

        // Compute Y from latitude within the lane band
        const latPercent = 1 - Math.min(1, Math.max(0, (site.geo.lat - lane.minLat) / laneLatRange));
        const targetY = laneY + (latPercent - 0.5) * yBand; // centered around laneY

        // Enforce minimal vertical separation relative to previous item in this lane
        if (idx === 0) {
          resolvedYs[idx] = targetY;
        } else {
          const minY = resolvedYs[idx - 1] + minVerticalSpacing;
          resolvedYs[idx] = Math.max(targetY, minY);
          // Clamp vertical band bounds
          const upperBound = laneY + yBand / 2;
          if (resolvedYs[idx] > upperBound) {
            // If we exceed, try nudging previous upwards slightly if possible
            const overflowY = resolvedYs[idx] - upperBound;
            for (let j = idx - 1; j >= 0 && overflowY > 0; j--) {
              const lowerNeighbor = (j === 0) ? (laneY - yBand / 2) : (resolvedYs[j - 1] + minVerticalSpacing);
              const canShiftUp = Math.max(0, resolvedYs[j] - lowerNeighbor);
              const shiftUp = Math.min(canShiftUp, overflowY);
              resolvedYs[j] -= shiftUp;
            }
            resolvedYs[idx] = Math.min(resolvedYs[idx], upperBound);
          }
        }

        newPositions[site.id] = { x: resolvedXs[idx], y: resolvedYs[idx] };
      });
    });

    // Apply computed positions with guard to avoid unnecessary updates
    setSitePositions(prev => {
      const keys = Object.keys(newPositions);
      const hasChanged = keys.some(id =>
        !prev[id] ||
        Math.abs(prev[id].x - newPositions[id].x) > 5 ||
        Math.abs(prev[id].y - newPositions[id].y) > 5
      );
      if (hasChanged) {
        console.log('Updating site positions (optimization init)');
        return { ...prev, ...newPositions };
      }
      return prev;
    });

  }, [isOptimizationView, sites, dimensions.width, dimensions.height, popDistanceThreshold]);

// ...

// Removed duplicate optimization-only positions effect (consolidated above)

// Render flattened optimization layout to match reference image
const renderFlattenedOptimization = () => {
  if (!isOptimizationView) return null;

// ...
    const optimalPOPs = getOptimalMegaportPOPs();

    // Layer positions for flattened view - proper layer separation
    const hyperscalerY = dimensions.height * 0.08; // Top layer - cloud services (higher)
    const naasY = dimensions.height * 0.35;        // Middle layer (Megaport ring)
    const customerY = dimensions.height * 0.75;    // Bottom layer - well separated but visible

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

    // Get ring positions for POPs ordered west to east
    const ringPOPs = getMegaportRingPositions();

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

              {/* Provider icon or fallback label */}
              {service.type === 'AWS' ? (
                <foreignObject
                  x={x - 32}
                  y={y - 18}
                  width="64"
                  height="22"
                  style={{ pointerEvents: 'none' }}
                >
                  {/* Local AWS logo asset */}
                  <img src={amazonAwsLocal} alt="AWS" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </foreignObject>
              ) : (
                <text
                  x={x}
                  y={y - 3}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#374151"
                  style={{ pointerEvents: 'none' }}
                >
                  {service.type}
                </text>
              )}

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
                d={`M ${x} ${y + 30} Q ${x} ${y + 80} ${centerX} ${centerY - 60}`}
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

        {/* Central Megaport Logo - Use the uploaded logo design */}
        <g>
          {/* White background circle for logo */}
          <circle
            cx={centerX}
            cy={centerY}
            r="50"
            fill="white"
            stroke="#e5e7eb"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' }}
          />

          {/* Megaport logo using the uploaded design - red circle with white icon */}
          <circle
            cx={centerX}
            cy={centerY}
            r="35"
            fill="#e53935"
          />

          {/* White network icon in center - simplified building/tower design */}
          <g transform={`translate(${centerX}, ${centerY})`}>
            {/* Main tower structure - white paths on red background */}
            <path
              d="M-12,-15 L12,-15 L12,-10 L8,-10 L8,-5 L-8,-5 L-8,-10 L-12,-10 Z"
              fill="white"
            />
            <path
              d="M-10,0 L10,0 L10,5 L5,5 L5,10 L-5,10 L-5,5 L-10,5 Z"
              fill="white"
            />
            <path
              d="M-8,15 L8,15 L8,20 L-8,20 Z"
              fill="white"
            />
            {/* Connection points */}
            <circle cx="0" cy="-2" r="2" fill="#e53935"/>
            <circle cx="-8" cy="7" r="1.5" fill="#e53935"/>
            <circle cx="8" cy="7" r="1.5" fill="#e53935"/>
          </g>

          {/* Megaport text below */}
          <text
            x={centerX}
            y={centerY + 70}
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fill="#2d2d2d"
          >
            Megaport
          </text>
        </g>

        {/* Megaport POPs positioned in oval ring west to east */}
        {ringPOPs.map((pop, index) => {
          const popX = pop.x * dimensions.width;
          const popY = pop.y * dimensions.height;
          const isCustomPOP = pop.isCustom;

          return (
            <g key={`cloud-pop-${pop.id}`}>
              {/* POP Node - Orange circles */}
              <circle
                cx={popX}
                cy={popY}
                r="30"
                fill={isCustomPOP ? "#10b981" : "#f97316"}
                stroke="white"
                strokeWidth="3"
                style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.25))' }}
              />

              {/* Inner white circle */}
              <circle
                cx={popX}
                cy={popY}
                r="20"
                fill="white"
                opacity="1"
              />

              {/* Small center dot */}
              <circle
                cx={popX}
                cy={popY}
                r="6"
                fill={isCustomPOP ? "#10b981" : "#f97316"}
                opacity="0.8"
              />

              {/* POP name positioned below */}
              <text
                x={popX}
                y={popY + 45}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={isCustomPOP ? "#10b981" : "#f97316"}
              >
                {pop.name}
              </text>

              {/* Remove button for custom POPs */}
              {isCustomPOP && (
                <g>
                  <circle
                    cx={popX + 22}
                    cy={popY - 22}
                    r="8"
                    fill="#ef4444"
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRemoveMegaportOnramp(pop.id)}
                  />
                  <text
                    x={popX + 22}
                    y={popY - 18}
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

        {/* Megaport Ring - Create complete oval ring connecting all POPs */}
        {ringPOPs.length >= 2 && (
          <g>
            {/* Draw complete oval ring */}
            <ellipse
              cx={centerX}
              cy={centerY}
              rx={dimensions.width * 0.22}
              ry={dimensions.height * 0.12}
              fill="none"
              stroke="#f97316"
              strokeWidth="3"
              opacity="0.8"
              strokeDasharray="0"
            />

            {/* Ring latency labels at key points */}
            {[
              { x: centerX - dimensions.width * 0.16, y: centerY, text: '2-4 ms' },
              { x: centerX, y: centerY - dimensions.height * 0.08, text: '3-6 ms' },
              { x: centerX + dimensions.width * 0.16, y: centerY, text: '2-5 ms' },
              { x: centerX, y: centerY + dimensions.height * 0.08, text: '4-7 ms' }
            ].slice(0, Math.min(4, ringPOPs.length)).map((label, index) => (
              <g key={`ring-label-${index}`}>
                <rect
                  x={label.x - 15}
                  y={label.y - 7}
                  width="30"
                  height="14"
                  fill="white"
                  stroke="#f97316"
                  strokeWidth="1"
                  rx="7"
                  opacity="0.9"
                />
                <text
                  x={label.x}
                  y={label.y + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="600"
                  fill="#f97316"
                >
                  {label.text}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Individual POP connections to cloud services */}
        {ringPOPs.map((pop, popIndex) => {
          const popX = pop.x * dimensions.width;
          const popY = pop.y * dimensions.height;

          return allTopServices.map((service, serviceIndex) => {
            const serviceSpacing = Math.max(180, dimensions.width / (allTopServices.length + 1));
            const serviceX = serviceSpacing * (serviceIndex + 1);
            const serviceY = hyperscalerY;

            // Each POP connects to each cloud service
            const latencies = [
              ['2 ms', '5 ms', '8 ms', '12 ms'],
              ['3 ms', '6 ms', '9 ms', '10 ms'],
              ['4 ms', '7 ms', '11 ms', '14 ms'],
              ['5 ms', '8 ms', '10 ms', '13 ms']
            ];
            const latency = latencies[popIndex % latencies.length][serviceIndex % 4] || '6 ms';

            return (
              <g key={`pop-service-${pop.id}-${service.id}`}>
                {/* Connection line from POP to service */}
                <path
                  d={`M ${popX} ${popY - 30} Q ${(popX + serviceX) / 2} ${(popY + serviceY) / 2 - 60} ${serviceX} ${serviceY + 30}`}
                  stroke="#9ca3af"
                  strokeWidth="1"
                  fill="none"
                  strokeDasharray="2,3"
                  opacity="0.4"
                />

                {/* Latency label on connection */}
                <rect
                  x={(popX + serviceX) / 2 - 12}
                  y={(popY + serviceY) / 2 - 40}
                  width="24"
                  height="14"
                  fill="white"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  rx="7"
                  opacity="0.8"
                />
                <text
                  x={(popX + serviceX) / 2}
                  y={(popY + serviceY) / 2 - 32}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="500"
                  fill="#6b7280"
                >
                  {latency}
                </text>
              </g>
            );
          });
        })}

        {/* Customer Sites */}
        {sites.map((site) => {
          const sitePos = sitePositions[site.id];
          if (!sitePos) return null;

          // Find nearest POP for connection rendering
          let nearestPOP: MegaportPOP | null = null;
          let minRealDistance = Infinity;

          ringPOPs.forEach(pop => {
            const realDistance = calculateRealDistance(site, pop);
            if (realDistance < minRealDistance) {
              minRealDistance = realDistance;
              nearestPOP = pop;
            }
          });

          const IconComponent = getSiteIcon(site.category);
          const siteColor = getSiteColor(site.category);

          return (
            <g key={`opt-site-${site.id}`}>
              {/* Connection line to nearest POP */}
              {nearestPOP && minRealDistance <= popDistanceThreshold && (
                (() => {
                  const np = nearestPOP as MegaportPOP;
                  return (
                    <>
                      <path
                        d={`M ${sitePos.x} ${sitePos.y - 25} Q ${(sitePos.x + np.x * dimensions.width) / 2} ${(sitePos.y + np.y * dimensions.height) / 2 - 50} ${np.x * dimensions.width} ${np.y * dimensions.height + 35}`}
                        stroke="#64748b"
                        strokeWidth="2"
                        fill="none"
                        opacity="0.6"
                      />
                    </>
                  );
                })()
              )}

              {/* Site name */}
              <text
                x={sitePos.x}
                y={sitePos.y + 42}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="#374151"
              >
                {site.name.length > 16 ? site.name.substring(0, 14) + '..' : site.name}
              </text>

              {/* Site category */}
              <text
                x={sitePos.x}
                y={sitePos.y + 56}
                textAnchor="middle"
                fontSize="10"
                fontWeight="500"
                fill="#6b7280"
              >
                {site.category}
              </text>

              {/* Mileage pill to nearest Megaport POP (computed) */}
              {nearestPOP && Number.isFinite(minRealDistance) && (
                <g>
                  <rect
                    x={sitePos.x - 22}
                    y={sitePos.y + 60}
                    width="44"
                    height="16"
                    rx="8"
                    fill="white"
                    stroke="#e5e7eb"
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  <text
                    x={sitePos.x}
                    y={sitePos.y + 71}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="#374151"
                  >
                    {`${Math.round(minRealDistance)} mi`}
                  </text>
                </g>
              )}

              {/* Distance indicator for sites within threshold */}
              {nearestPOP && minRealDistance <= popDistanceThreshold && (
                <circle
                  cx={sitePos.x + 20}
                  cy={sitePos.y - 20}
                  r="6"
                  fill="#10b981"
                  stroke="white"
                  strokeWidth="2"
                />
              )}
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
          Optimized Network with Megaport
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
          style={{ cursor: isOptimizationView ? 'default' : (isDragging === site.id ? 'grabbing' : 'grab') }}
          onMouseDown={isOptimizationView ? undefined : handleMouseDown(site.id)}
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
                        calculateRealDistance(site, pop)
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
                      const dcDistance = calculateDistance(site, {
                        id: westCoastDC.id,
                        x: westCoastDC.coordinates.x,
                        y: westCoastDC.coordinates.y,
                      });
                      if (dcDistance <= popDistanceThreshold && dcDistance < 1500) {
                        westCoastSites++;
                        distances.push({ site: site.name, distance: Math.round(dcDistance) });
                        return;
                      }
                    }

                    // Find nearest POP
                    let closestPOP: { name: string; id: string; x: number; y: number } | null = null;
                    let minDistance = Infinity;

                    optimalPOPs.forEach(pop => {
                      const distance = calculateDistance(site, pop);
                      if (distance < minDistance) {
                        minDistance = distance;
                        closestPOP = pop;
                      }
                    });

                    if (closestPOP) {
                      const key = (closestPOP as any).name || (closestPOP as any).id;
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
          onDelete={handleDeleteSite}
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