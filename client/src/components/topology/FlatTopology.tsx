import * as React from "react";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Hyper = { id: string; name: string; kind: "aws"|"azure"|"gcp"|"oci"|"app" };
type Pop   = { id: string; name: string; lat: number; lon: number; facility?: string };
type Site  = { id: string; name: string; lat: number; lon: number; city?: string; state?: string };
export type TopologyData = { hypers: Hyper[]; pops: Pop[]; sites: Site[] };

const R = 6371; const rad = (d:number)=>d*Math.PI/180;
const haversineKm = (a:{lat:number;lon:number}, b:{lat:number;lon:number})=>{
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon), la1=rad(a.lat), la2=rad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};
const color = (seed:string)=>`hsl(${Array.from(seed).reduce((h,c)=>((h*31+c.charCodeAt(0))>>>0),0)%360} 60% 50%)`;

type Layout = {
  pos: Record<string,{x:number;y:number;type:"hyper"|"pop"|"site";label:string}>;
  links: Array<{from:string;to:string;kind:"site->pop"|"pop->hyper"}>;
};

// Regional clustering logic for intelligent geographic grouping
function getRegionalClusters(sites: Site[]): { regionName: string; sites: Site[]; avgLon: number }[] {
  // Define geographic regions with their longitude ranges and state mappings
  const regions = {
    "Pacific Northwest": { lonRange: [-125, -116.5], states: ["WA", "OR"], priority: 1 },
    "California": { lonRange: [-125, -114], states: ["CA"], priority: 2 },
    "Southwest": { lonRange: [-119, -103], states: ["AZ", "NV", "UT", "NM"], priority: 3 },
    "Mountain West": { lonRange: [-115, -102], states: ["CO", "WY", "MT", "ID"], priority: 4 },
    "Texas": { lonRange: [-107, -93.5], states: ["TX"], priority: 5 },
    "Midwest": { lonRange: [-104, -80], states: ["IL", "IN", "OH", "MI", "WI", "MN", "IA", "MO", "KS", "NE", "ND", "SD"], priority: 6 },
    "Southeast": { lonRange: [-92, -75], states: ["FL", "GA", "AL", "MS", "LA", "AR", "TN", "KY", "SC", "NC"], priority: 7 },
    "Northeast": { lonRange: [-80, -66], states: ["NY", "NJ", "PA", "CT", "RI", "MA", "VT", "NH", "ME", "MD", "DE", "DC"], priority: 8 }
  };

  // First, group sites by state to determine regional patterns
  const sitesByState: Record<string, Site[]> = {};
  sites.forEach(site => {
    const state = site.state || "Unknown";
    (sitesByState[state] ||= []).push(site);
  });

  // Determine which regions have sites
  const regionCounts: Record<string, Site[]> = {};
  Object.entries(sitesByState).forEach(([state, stateSites]) => {
    const region = Object.entries(regions).find(([_, config]) => 
      config.states.includes(state)
    )?.[0] || "Other";
    (regionCounts[region] ||= []).push(...stateSites);
  });

  // Apply intelligent naming rules
  const clusters: { regionName: string; sites: Site[]; avgLon: number }[] = [];
  
  Object.entries(regionCounts).forEach(([region, regionSites]) => {
    if (regionSites.length === 0) return;
    
    // Calculate average longitude for west-to-east ordering
    const avgLon = regionSites.reduce((sum, site) => sum + site.lon, 0) / regionSites.length;
    
    // Apply intelligent naming based on site distribution
    let finalName = region;
    
    // Special case: If all sites are in one state, use state name
    const uniqueStates = Array.from(new Set(regionSites.map(s => s.state)));
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
      sites: regionSites.sort((a, b) => a.lon - b.lon), // Sort west to east within region
      avgLon
    });
  });

  // Sort clusters by average longitude (west to east)
  return clusters.sort((a, b) => a.avgLon - b.avgLon);
}

function buildLayout(data: TopologyData, width:number, height:number, optimized:boolean): Layout {
  const pad=32, gap = Math.max(120, Math.round(height/7));
  const topY = pad+16, midY = topY+gap;
  const pos: Layout["pos"] = {}; const links: Layout["links"] = [];

  const spread = <T extends {id:string}>(arr:T[], y:number) => {
    const n = Math.max(1, arr.length), step = n>1 ? (width-2*pad)/(n-1) : 0;
    return arr.map((it,i)=>({ id: it.id, x: pad+i*step, y }));
  };

  // top: hypers/apps
  for (const n of spread(data.hypers, topY)) {
    const h = data.hypers.find(x=>x.id===n.id)!;
    pos[h.id] = { x:n.x, y:n.y, type:"hyper", label:h.name };
  }
  // mid: pops
  for (const n of spread(data.pops, midY)) {
    const p = data.pops.find(x=>x.id===n.id)!;
    pos[p.id] = { x:n.x, y:n.y, type:"pop", label:p.name+(p.facility?` · ${p.facility}`:"") };
  }

  // Regional site clustering
  if (optimized) {
    const regionalClusters = getRegionalClusters(data.sites);
    console.log("Regional clusters created:", regionalClusters.map(c => `${c.regionName}: ${c.sites.length} sites`));
    
    const rowHeight = 80;
    const siteRadius = 16;
    const siteSpacing = 45;
    
    regionalClusters.forEach((cluster, clusterIndex) => {
      const rowY = midY + gap + (clusterIndex + 1) * rowHeight;
      
      // Calculate cluster width and center position
      const clusterWidth = Math.max(200, cluster.sites.length * siteSpacing);
      const clusterStartX = pad + (clusterIndex * (width - 2*pad) / regionalClusters.length);
      const clusterCenterX = clusterStartX + (width - 2*pad) / regionalClusters.length / 2;
      
      // Position sites in the cluster from west to east
      cluster.sites.forEach((site, siteIndex) => {
        const siteX = clusterCenterX - (clusterWidth/2) + (siteIndex * clusterWidth / Math.max(1, cluster.sites.length - 1));
        pos[site.id] = { 
          x: siteX, 
          y: rowY, 
          type: "site", 
          label: site.name 
        };
        
        // Connect to nearest POP
        let bestPop = data.pops[0], bestDistance = Number.POSITIVE_INFINITY;
        for (const pop of data.pops) {
          const distance = haversineKm(site, pop);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestPop = pop;
          }
        }
        links.push({ from: site.id, to: bestPop.id, kind: "site->pop" });
      });
      
      // Add region label
      pos[`region-${clusterIndex}`] = {
        x: clusterCenterX,
        y: rowY - 25,
        type: "region-label" as any,
        label: cluster.regionName
      };
    });
  } else {
    // legacy spread + round-robin pop link
    const botY = midY + gap;
    const placed = spread(data.sites, botY);
    placed.forEach((n,i)=>{
      const s = data.sites.find(x=>x.id===n.id)!;
      pos[s.id] = { x:n.x, y:n.y, type:"site", label:s.name };
      const p = data.pops[i % Math.max(1,data.pops.length)];
      links.push({ from: s.id, to: p.id, kind:"site->pop" });
    });
  }

  // POP -> Hyper links (light dashed)
  for (const p of data.pops) for (const h of data.hypers) links.push({ from:p.id, to:h.id, kind:"pop->hyper" });

  return { pos, links };
}

export default function FlatTopology({ data, width=1100, height=620 }: { data: TopologyData; width?:number; height?:number; }) {
  const [optimized, setOptimized] = useState(true);
  const layout = useMemo(()=>buildLayout(data, width, height, optimized), [data,width,height,optimized]);

  return (
    <div className="w-full rounded-2xl border bg-white/70 dark:bg-neutral-900 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Flattened Topology</h2>
          <p className="text-xs text-neutral-500">Top: Hypers & Apps · Middle: Megaport POPs · Bottom: Sites</p>
        </div>
        <div className="flex gap-2">
          <button className={`px-3 py-1.5 rounded-xl text-sm border ${!optimized ? "bg-black text-white border-black":"bg-white dark:bg-neutral-800"}`} onClick={()=>setOptimized(false)}>Legacy</button>
          <button className={`px-3 py-1.5 rounded-xl text-sm border ${ optimized ? "bg-black text-white border-black":"bg-white dark:bg-neutral-800"}`} onClick={()=>setOptimized(true)}>Optimize My Network</button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-white/80 dark:bg-neutral-950">
        <svg width={width} height={height} className="block w-full h-auto">
          {/* helper row lines */}
          <line x1="0" y1="100" x2={width} y2="100" stroke="currentColor" strokeOpacity="0.05"/>
          <line x1="0" y1="240" x2={width} y2="240" stroke="currentColor" strokeOpacity="0.05"/>
          <line x1="0" y1="380" x2={width} y2="380" stroke="currentColor" strokeOpacity="0.05"/>

          {/* links */}
          <g>
            {layout.links.map((l, i) => {
              const a = layout.pos[l.from], b = layout.pos[l.to]; if (!a || !b) return null;
              const curved = l.kind === "pop->hyper";
              const midX = (a.x + b.x) / 2, ctrlY = (a.y + b.y) / 2 - 40;
              const d = curved ? `M ${a.x} ${a.y} Q ${midX} ${ctrlY} ${b.x} ${b.y}` : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
              return (
                <path key={i} d={d}
                  fill="none"
                  stroke={l.kind==="site->pop" ? "#10b981" : "#64748b"}
                  strokeWidth={l.kind==="site->pop" ? 1.8 : 1.4}
                  strokeOpacity={l.kind==="site->pop" ? 0.9 : 0.5}
                  strokeDasharray={l.kind==="site->pop" ? undefined : "6 6"}
                />
              );
            })}
          </g>

          {/* nodes */}
          <AnimatePresence>
            {Object.entries(layout.pos).map(([id, n]) => (
              <motion.g key={id} initial={{opacity:0,x:n.x,y:n.y-8}} animate={{opacity:1,x:n.x,y:n.y}} exit={{opacity:0}} transition={{type:"spring",stiffness:90,damping:16}}>
                {n.type==="pop" ? (
                  <>
                    <circle r={22} fill="#f97316" stroke="white" strokeWidth={3}/>
                    <text y={42} textAnchor="middle" fontSize="12" fill="#374151" fontWeight={600}>{n.label}</text>
                  </>
                ) : n.type==="hyper" ? (
                  <>
                    <rect x={-70} y={-20} width={140} height={40} rx={10} fill="white" stroke="#e5e7eb" strokeWidth={2}/>
                    <text y={4} textAnchor="middle" fontSize="13" fontWeight={600} fill="#111827">{n.label}</text>
                  </>
                ) : (n.type as any)==="region-label" ? (
                  <>
                    <rect x={-60} y={-12} width={120} height={24} rx={12} fill="#3b82f6" stroke="white" strokeWidth={2}/>
                    <text y={4} textAnchor="middle" fontSize="12" fontWeight={700} fill="white">{n.label}</text>
                  </>
                ) : (
                  <>
                    <circle r={16} fill={color(id)} stroke="white" strokeWidth={2}/>
                    <text y={32} textAnchor="middle" fontSize="11" fill="#111827">{n.label}</text>
                  </>
                )}
              </motion.g>
            ))}
          </AnimatePresence>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{background:"#10b981"}}/>Site → POP</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{background:"#f97316"}}/>Megaport POP</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm border border-neutral-300 bg-white"/>Hypers/App</span>
      </div>
    </div>
  );
}