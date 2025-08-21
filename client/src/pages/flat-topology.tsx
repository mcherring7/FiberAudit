import React, { useEffect, useMemo, useState } from "react";

// Types for this page
type Hyper = { id: string; name: string; kind: "aws" | "azure" | "gcp" };
type Pop = { id: string; name: string; lat: number; lon: number; facility?: string };
type Site = { id: string; name: string; lat: number; lon: number; city?: string; state?: string };

type TopologyData = { hypers: Hyper[]; pops: Pop[]; sites: Site[] };

type NodePos = { x: number; y: number; type: "hyper" | "pop" | "site"; label: string };

type Link = { from: string; to: string; kind: "site->pop" | "pop->hyper" };

type Layout = { pos: Record<string, NodePos>; links: Link[] };

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon), la1 = rad(a.lat), la2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const color = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 55%)`;
};

function buildLayout(data: TopologyData, width: number, height: number, optimized: boolean): Layout {
  const pos: Record<string, NodePos> = {};
  const links: Link[] = [];

  const margin = 32;
  const rowY = { hyper: 90, pop: 240, site: 420 };

  // Hypers
  const hypersX = (i: number, n: number) => margin + (i + 0.5) * ((width - 2 * margin) / Math.max(1, n));
  data.hypers.forEach((h, i) => {
    pos[h.id] = { x: hypersX(i, data.hypers.length), y: rowY.hyper, type: "hyper", label: h.name };
  });

  // POPs
  const popsX = (i: number, n: number) => margin + (i + 0.5) * ((width - 2 * margin) / Math.max(1, n));
  data.pops.forEach((p, i) => {
    pos[p.id] = { x: popsX(i, data.pops.length), y: rowY.pop, type: "pop", label: p.name };
  });

  // Site grouping to nearest POP
  const groups: Record<string, Site[]> = {};
  // store computed straight-line miles to nearest POP for label fallback
  const siteMiles: Record<string, number> = {};
  for (const s of data.sites) {
    let best = data.pops[0], bestD = Number.POSITIVE_INFINITY;
    for (const p of data.pops) {
      const d = haversineKm(s, p);
      if (d < bestD) { bestD = d; best = p; }
    }
    (groups[best.id] ||= []).push(s);
    links.push({ from: s.id, to: best.id, kind: "site->pop" });
    if (Number.isFinite(bestD)) {
      siteMiles[s.id] = bestD * 0.621371; // km -> miles
    }
  }

  // Place sites under each POP (simple spread)
  const siteRadius = 80;
  for (const [popId, sites] of Object.entries(groups)) {
    const base = pos[popId];
    const n = sites.length;
    for (let i = 0; i < n; i++) {
      const angle = (-Math.PI / 2) + (i - (n - 1) / 2) * (Math.PI / Math.max(2, n));
      const x = base.x + Math.cos(angle) * siteRadius;
      const y = rowY.site + Math.sin(0) * 0; // keep in straight row visually
      const s = sites[i];
      // Ensure label includes mileage. If name already has a delimiter, keep base name.
      const baseName = (s.name || "Site").split(" · ")[0];
      const mi = siteMiles[s.id];
      const label = Number.isFinite(mi) ? `${baseName} · ${mi.toFixed(1)} mi` : baseName;
      pos[s.id] = { x, y, type: "site", label };
    }
  }

  // POP -> Hyper links (light dashed)
  for (const p of data.pops) for (const h of data.hypers) links.push({ from: p.id, to: h.id, kind: "pop->hyper" });

  return { pos, links };
}

export default function FlatTopologyPage() {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimized, setOptimized] = useState(true);

  // Resolve current projectId similarly to network-topology
  const projectId = useMemo(() => {
    const parts = window.location.pathname.split('/');
    const idx = parts.indexOf('projects');
    if (idx !== -1 && idx < parts.length - 1) {
      const pid = parts[idx + 1];
      if (pid) return pid;
    }
    const qs = new URLSearchParams(window.location.search).get('projectId');
    if (qs && qs.trim()) return qs.trim();
    const ls = localStorage.getItem('currentProjectId');
    if (ls && ls.trim()) return ls.trim();
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (!projectId) throw new Error('No project selected');

        const [popsRes, sitesRes] = await Promise.all([
          fetch('/api/megaport/locations'),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/sites`),
        ]);
        if (!popsRes.ok) throw new Error(`POP load failed (${popsRes.status})`);
        if (!sitesRes.ok) throw new Error(`Sites load failed (${sitesRes.status})`);

        const popsJson = await popsRes.json();
        const sitesJson = await sitesRes.json();

        const hypers: Hyper[] = [
          { id: 'aws', name: 'AWS', kind: 'aws' },
          { id: 'azure', name: 'Azure', kind: 'azure' },
          { id: 'gcp', name: 'Google Cloud', kind: 'gcp' },
        ];

        const pops: Pop[] = (Array.isArray(popsJson) ? popsJson : []).map((p: any) => ({
          id: p.id?.toString() || `${p.city}-${p.name}`,
          name: p.name || p.city || 'POP',
          lat: Number(p.lat ?? p.latitude),
          lon: Number(p.lng ?? p.longitude),
          facility: p.city,
        })).filter((p: Pop) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

        const kmToMi = (km?: number | null) =>
          typeof km === 'number' && isFinite(km) ? km * 0.621371 : undefined;

        const sites: Site[] = (Array.isArray(sitesJson) ? sitesJson : []).map((s: any) => {
          const miles = kmToMi(s.megaportDistance);
          const nameWithMi = typeof miles === 'number' ? `${s.name || s.location || 'Site'} · ${miles.toFixed(1)} mi` : (s.name || s.location || 'Site');
          return {
            id: s.id?.toString(),
            name: nameWithMi,
            lat: Number(s.latitude ?? s.lat),
            lon: Number(s.longitude ?? s.lon),
            city: s.city || undefined,
            state: s.state || undefined,
          };
        }).filter((s: Site) => Number.isFinite(s.lat) && Number.isFinite(s.lon));

        if (!cancelled) setData({ hypers, pops, sites });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const width = 1100, height = 620;
  const layout = useMemo(() => (data ? buildLayout(data, width, height, optimized) : null), [data, optimized]);

  if (loading) return <div className="p-6 text-sm">Loading optimized flat topology…</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!data || !layout) return <div className="p-6 text-sm">No data</div>;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Optimized Flat Topology</h1>
          <p className="text-xs text-gray-600">Top: Hypers & Apps · Middle: Megaport POPs · Bottom: Sites (labels include straight-line miles to nearest POP)</p>
        </div>
        <div className="flex gap-2">
          <button className={`px-3 py-1.5 rounded border text-sm ${!optimized ? 'bg-black text-white border-black' : 'bg-white'}`} onClick={() => setOptimized(false)}>Legacy</button>
          <button className={`px-3 py-1.5 rounded border text-sm ${optimized ? 'bg-black text-white border-black' : 'bg-white'}`} onClick={() => setOptimized(true)}>Optimize</button>
        </div>
      </div>

      <div className="p-4">
        <div className="relative overflow-hidden rounded-lg bg-white shadow">
          <svg width={width} height={height} className="block w-full h-auto">
            {/* helper row lines */}
            <line x1="0" y1="100" x2={width} y2="100" stroke="currentColor" strokeOpacity="0.05" />
            <line x1="0" y1="240" x2={width} y2="240" stroke="currentColor" strokeOpacity="0.05" />
            <line x1="0" y1="420" x2={width} y2="420" stroke="currentColor" strokeOpacity="0.05" />

            {/* links */}
            <g>
              {layout.links.map((l, i) => {
                const a = layout.pos[l.from], b = layout.pos[l.to];
                if (!a || !b) return null;
                const curved = l.kind === 'pop->hyper';
                const midX = (a.x + b.x) / 2, ctrlY = (a.y + b.y) / 2 - 40;
                const d = curved ? `M ${a.x} ${a.y} Q ${midX} ${ctrlY} ${b.x} ${b.y}` : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
                return (
                  <path key={i} d={d} fill="none" stroke={l.kind === 'site->pop' ? '#10b981' : '#64748b'} strokeWidth={l.kind === 'site->pop' ? 1.8 : 1.2} strokeOpacity={l.kind === 'site->pop' ? 0.9 : 0.5} strokeDasharray={l.kind === 'site->pop' ? undefined : '6 6'} />
                );
              })}
            </g>

            {/* nodes */}
            {Object.entries(layout.pos).map(([id, n]) => (
              <g key={id} transform={`translate(${n.x},${n.y})`}>
                {n.type === 'pop' ? (
                  <>
                    <circle r={22} fill="#f97316" stroke="white" strokeWidth={3} />
                    <text y={42} textAnchor="middle" fontSize="12" fill="#374151" fontWeight={600}>{n.label}</text>
                  </>
                ) : n.type === 'hyper' ? (
                  <>
                    <rect x={-72} y={-22} width={144} height={44} rx={10} fill="white" stroke="#e5e7eb" strokeWidth={2} />
                    {/* simple provider badges */}
                    {(() => {
                      const id = n.label.toLowerCase();
                      if (id.includes('aws')) {
                        return (
                          <g>
                            <circle cx={-52} cy={0} r={10} fill="#f59e0b" />
                            <text x={-52} y={4} textAnchor="middle" fontSize="8" fontWeight={700} fill="white">AWS</text>
                          </g>
                        );
                      }
                      if (id.includes('azure')) {
                        return (
                          <g>
                            <rect x={-62} y={-10} width={20} height={20} rx={4} fill="#2563eb" />
                            <text x={-52} y={4} textAnchor="middle" fontSize="8" fontWeight={700} fill="white">AZ</text>
                          </g>
                        );
                      }
                      if (id.includes('google') || id.includes('gcp')) {
                        return (
                          <g>
                            <circle cx={-52} cy={0} r={10} fill="#10b981" />
                            <text x={-52} y={4} textAnchor="middle" fontSize="8" fontWeight={700} fill="white">GCP</text>
                          </g>
                        );
                      }
                      return null;
                    })()}
                    <text y={4} textAnchor="middle" fontSize="13" fontWeight={600} fill="#111827">{n.label}</text>
                  </>
                ) : (
                  <>
                    <circle r={16} fill={color(id)} stroke="white" strokeWidth={2} />
                    <text y={32} textAnchor="middle" fontSize="11" fill="#111827">{n.label}</text>
                  </>
                )}
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{ background: '#10b981' }} /> Site → POP</span>
          <span className="inline-flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full" style={{ background: '#f97316' }} /> Megaport POP</span>
          <span className="inline-flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm border border-gray-300 bg-white" /> Hypers/App</span>
        </div>
      </div>
    </div>
  );
}
