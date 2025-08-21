import * as React from "react";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
};
export type TopologyData = { hypers: Hyper[]; pops: Pop[]; sites: Site[] };

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

export default function FlatTopology({
  data,
  width = 1100,
  height = 620,
}: {
  data: TopologyData;
  width?: number;
  height?: number;
}) {
  const [optimized, setOptimized] = useState(true);
  const layout = useMemo(
    () => buildLayout(data, width, height, optimized),
    [data, width, height, optimized],
  );

  return (
    <div className="w-full rounded-2xl border bg-white/70 dark:bg-neutral-900 p-4 shadow">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Flattened Topology</h2>
          <p className="text-xs text-neutral-500">
            Top: Hypers & Apps · Middle: Megaport POPs · Bottom: Sites
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-xl text-sm border ${!optimized ? "bg-black text-white border-black" : "bg-white dark:bg-neutral-800"}`}
            onClick={() => setOptimized(false)}
          >
            Legacy
          </button>
          <button
            className={`px-3 py-1.5 rounded-xl text-sm border ${optimized ? "bg-black text-white border-black" : "bg-white dark:bg-neutral-800"}`}
            onClick={() => setOptimized(true)}
          >
            Optimize My Network
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-white/80 dark:bg-neutral-950">
        <svg width={width} height={height} className="block w-full h-auto">
          {/* helper row lines */}
          <line
            x1="0"
            y1="100"
            x2={width}
            y2="100"
            stroke="currentColor"
            strokeOpacity="0.05"
          />
          <line
            x1="0"
            y1="240"
            x2={width}
            y2="240"
            stroke="currentColor"
            strokeOpacity="0.05"
          />
          <line
            x1="0"
            y1="380"
            x2={width}
            y2="380"
            stroke="currentColor"
            strokeOpacity="0.05"
          />

          {/* links */}
          <g>
            {layout.links.map((l, i) => {
              const a = layout.pos[l.from],
                b = layout.pos[l.to];
              if (!a || !b) return null;
              const curved = l.kind === "pop->hyper";
              const midX = (a.x + b.x) / 2,
                ctrlY = (a.y + b.y) / 2 - 40;
              const d = curved
                ? `M ${a.x} ${a.y} Q ${midX} ${ctrlY} ${b.x} ${b.y}`
                : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={l.kind === "site->pop" ? "#10b981" : "#64748b"}
                  strokeWidth={l.kind === "site->pop" ? 1.8 : 1.4}
                  strokeOpacity={l.kind === "site->pop" ? 0.9 : 0.5}
                  strokeDasharray={l.kind === "site->pop" ? undefined : "6 6"}
                />
              );
            })}
          </g>

          {/* nodes */}
          <AnimatePresence>
            {Object.entries(layout.pos).map(([id, n]) => (
              <motion.g
                key={id}
                initial={{ opacity: 0, x: n.x, y: n.y - 8 }}
                animate={{ opacity: 1, x: n.x, y: n.y }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 90, damping: 16 }}
              >
                {n.type === "pop" ? (
                  <>
                    <circle
                      r={22}
                      fill="#f97316"
                      stroke="white"
                      strokeWidth={3}
                    />
                    <text
                      y={42}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#374151"
                      fontWeight={600}
                    >
                      {n.label}
                    </text>
                  </>
                ) : n.type === "hyper" ? (
                  <>
                    <rect
                      x={-70}
                      y={-20}
                      width={140}
                      height={40}
                      rx={10}
                      fill="white"
                      stroke="#e5e7eb"
                      strokeWidth={2}
                    />
                    <text
                      y={4}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight={600}
                      fill="#111827"
                    >
                      {n.label}
                    </text>
                  </>
                ) : (
                  <>
                    <circle
                      r={16}
                      fill={color(id)}
                      stroke="white"
                      strokeWidth={2}
                    />
                    <text
                      y={32}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#111827"
                    >
                      {n.label}
                    </text>
                  </>
                )}
              </motion.g>
            ))}
          </AnimatePresence>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: "#10b981" }}
          />
          Site → POP
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: "#f97316" }}
          />
          Megaport POP
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm border border-neutral-300 bg-white" />
          Hypers/App
        </span>
      </div>
    </div>
  );
}
