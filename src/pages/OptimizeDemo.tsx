import React, { useEffect, useState } from "react";
import FlatTopology, { TopologyData } from "../components/FlatTopology";

type Hyper = {
  id: string;
  name: string;
  kind: "aws" | "azure" | "gcp" | "oci" | "app";
};
type Pop = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  facility?: string;
};
type Site = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  city?: string;
  state?: string;
  category?: string;
};
// TopologyData type is imported from components/FlatTopology

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const haversineKm = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) => {
  const dLat = rad(b.lat - a.lat),
    dLon = rad(b.lon - a.lon),
    la1 = rad(a.lat),
    la2 = rad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const color = (seed: string) =>
  `hsl(${Array.from(seed).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 360} 60% 50%)`;

type Layout = {
  pos: Record<
    string,
    { x: number; y: number; type: "hyper" | "pop" | "site"; label: string }
  >;
  links: Array<{ from: string; to: string; kind: "site->pop" | "pop->hyper" }>;
};

function buildLayout(
  data: TopologyData,
  width: number,
  height: number,
  optimized: boolean,
): Layout {
  const pad = 32,
    gap = Math.max(140, Math.round(height / 6));
  const topY = pad + 16,
    midY = topY + gap,
    botY = midY + gap;
  const pos: Layout["pos"] = {};
  const links: Layout["links"] = [];

  const spread = <T extends { id: string }>(arr: T[], y: number) => {
    const n = Math.max(1, arr.length),
      step = n > 1 ? (width - 2 * pad) / (n - 1) : 0;
    return arr.map((it, i) => ({ id: it.id, x: pad + i * step, y }));
  };

  // top: hypers/apps
  for (const n of spread(data.hypers, topY)) {
    const h = data.hypers.find((x) => x.id === n.id)!;
    pos[h.id] = { x: n.x, y: n.y, type: "hyper", label: h.name };
  }
  // mid: pops
  for (const n of spread(data.pops, midY)) {
    const p = data.pops.find((x) => x.id === n.id)!;
    pos[p.id] = {
      x: n.x,
      y: n.y,
      type: "pop",
      label: p.name + (p.facility ? ` · ${p.facility}` : ""),
    };
  }

  // site placement
  if (optimized) {
    // group sites to nearest pop
    const groups: Record<string, Site[]> = {};
    for (const s of data.sites) {
      let best = data.pops[0],
        bestD = Number.POSITIVE_INFINITY;
      for (const p of data.pops) {
        const d = haversineKm(s, p);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      (groups[best.id] ||= []).push(s);
      links.push({ from: s.id, to: best.id, kind: "site->pop" });
    }
    const clusterW = 220;
    for (const p of data.pops) {
      const g = groups[p.id] || [];
      if (!g.length) continue;
      const cx = pos[p.id].x,
        step = g.length > 1 ? clusterW / (g.length - 1) : 0;
      g.forEach((s, i) => {
        pos[s.id] = {
          x: cx - clusterW / 2 + i * step,
          y: botY,
          type: "site",
          label: s.name,
        };
      });
    }
  } else {
    // legacy spread + round-robin pop link
    // --- BEGIN fan-out helper (drop-in; no other imports needed) ---
    function spreadWithFanout(
      sites: { id: string; name: string }[],
      rowY: number,
      pixelBucket = 6, // consider points this close as overlapping
      ringStep = 8, // how far to push overlapping points apart
    ) {
      // keep your original left→right positioning
      const pad = 40;
      const step = 48;
      const base = sites.map((it, i) => ({
        id: it.id,
        x: pad + i * step,
        y: rowY,
      }));

      // bucket by near-identical screen positions
      const buckets = new Map<string, { id: string; x: number; y: number }[]>();
      for (const p of base) {
        const kx = Math.round(p.x / pixelBucket);
        const ky = Math.round(p.y / pixelBucket);
        const key = `${kx}:${ky}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(p);
      }

      const out: { id: string; x: number; y: number }[] = [];
      const golden = Math.PI * (3 - Math.sqrt(5)); // golden angle

      for (const group of buckets.values()) {
        if (group.length === 1) {
          out.push(group[0]);
          continue;
        }
        // fan out around group centroid
        const cx = group.reduce((a, b) => a + b.x, 0) / group.length;
        const cy = group.reduce((a, b) => a + b.y, 0) / group.length;

        group.forEach((g, i) => {
          const r = ringStep * Math.sqrt(i);
          const t = i * golden;
          out.push({
            id: g.id,
            x: cx + r * Math.cos(t),
            y: cy + r * Math.sin(t),
          });
        });
      }

      return out; // [{id,x,y}]
    }
    // --- END fan-out helper ---
    const placed = spreadWithFanout(data.sites, botY);
    placed.forEach((n, i) => {
      const s = data.sites.find((x) => x.id === n.id)!;
      pos[s.id] = { x: n.x, y: n.y, type: "site", label: s.name };
      const p = data.pops[i % Math.max(1, data.pops.length)];
      links.push({ from: s.id, to: p.id, kind: "site->pop" });
    });
  }

  // POP -> Hyper links (light dashed)
  for (const p of data.pops)
    for (const h of data.hypers)
      links.push({ from: p.id, to: h.id, kind: "pop->hyper" });

  return { pos, links };
}

export default function OptimizeDemo() {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve active projectId from URL (/projects/:id), query (?projectId=), or localStorage
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const idx = pathParts.indexOf('projects');
    if (idx !== -1 && idx < pathParts.length - 1) {
      const pid = pathParts[idx + 1];
      if (pid && !pid.includes('/')) {
        setProjectId(pid);
        return;
      }
    }
    const qs = new URLSearchParams(window.location.search).get('projectId');
    if (qs && qs.trim()) {
      setProjectId(qs.trim());
      return;
    }
    const ls = localStorage.getItem('currentProjectId');
    if (ls && ls.trim()) {
      setProjectId(ls.trim());
      return;
    }
    setProjectId(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (!projectId) throw new Error("No project selected");

        const [popsRes, sitesRes, appsRes] = await Promise.all([
          fetch("/api/megaport/locations"),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/sites`),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/cloud-apps`),
        ]);
        if (!popsRes.ok) throw new Error(`POP load failed (${popsRes.status})`);
        if (!sitesRes.ok) throw new Error(`Sites load failed (${sitesRes.status})`);
        if (!appsRes.ok) throw new Error(`Cloud apps load failed (${appsRes.status})`);

        const popsJson = await popsRes.json();
        const sitesJson = await sitesRes.json();
        const appsJson = await appsRes.json();

        // Build hypers/apps from project inventory only
        // Include present hyperscalers (AWS/Azure/GCP) and SaaS apps by name
        const providerSet = new Set<string>();
        const appItems: Array<{ id: string; name: string; kind: "app" }> = [];
        const norm = (s: string) => s.trim().toLowerCase();
        for (const a of Array.isArray(appsJson) ? appsJson : []) {
          const name = (a?.name || "").toString();
          const provider = (a?.provider || "").toString();
          const p = norm(provider);
          if (p === "aws" || p.includes("amazon web services") || p === "amazon") providerSet.add("aws");
          else if (p === "azure" || p.includes("microsoft azure")) providerSet.add("azure");
          else if (p.includes("google cloud") || p === "gcp" || p === "google") providerSet.add("gcp");

          if (name) {
            const id = `app-${norm(name).replace(/[^a-z0-9]+/g, "-")}`;
            appItems.push({ id, name, kind: "app" });
          }
        }

        const hypers = [
          ...[...providerSet].map((k) => ({ id: k, name: k === "aws" ? "AWS" : k === "azure" ? "Azure" : "Google Cloud", kind: k as "aws" | "azure" | "gcp" })),
          ...appItems,
        ];

        // Map pops to expected shape
        const pops = (Array.isArray(popsJson) ? popsJson : []).map((p: any) => ({
          id: p.id?.toString() || `${p.city}-${p.name}`,
          name: p.name || p.city || "POP",
          lat: Number(p.lat ?? p.latitude),
          lon: Number(p.lng ?? p.longitude),
          facility: p.city,
        })).filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

        // Map sites and include mileage (km->mi) in label
        const kmToMi = (km?: number | null) =>
          typeof km === "number" && isFinite(km) ? km * 0.621371 : undefined;

        const sites = (Array.isArray(sitesJson) ? sitesJson : []).map((s: any) => {
          const miles = kmToMi(s.megaportDistance);
          const nameWithMi = typeof miles === "number"
            ? `${s.name || s.location || "Site"} · ${miles.toFixed(1)} mi`
            : (s.name || s.location || "Site");
          return {
            id: s.id?.toString(),
            name: nameWithMi,
            lat: Number(s.latitude ?? s.lat),
            lon: Number(s.longitude ?? s.lon),
            city: s.city || undefined,
            state: s.state || undefined,
            category: s.category || undefined,
          };
        }).filter((s: any) => Number.isFinite(s.lat) && Number.isFinite(s.lon));

        if (!cancelled) {
          setData({ hypers, pops, sites });
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) return <div className="p-4 text-sm">Loading optimized view…</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (!data) return <div className="p-4 text-sm">No data</div>;

  return (
    <div className="p-4">
      <FlatTopology data={data} />
      <div className="mt-2 text-xs text-neutral-500">
        Distances shown are straight-line to nearest Megaport POP.
      </div>
    </div>
  );
}
