import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertCircuitSchema, insertAuditFlagSchema, insertCloudAppSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
// Removed direct DB imports to allow running without DATABASE_URL in dev
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { fileURLToPath } from "url";

// Derive circuit category from service type
function deriveCircuitCategory(serviceType?: string, currentCategory?: string): string | undefined {
  const s = (serviceType || '').toLowerCase();
  const cur = (currentCategory || '').toLowerCase();
  // Only override if not explicitly set or set to a generic Internet
  const shouldOverride = !cur || cur === 'internet';

  if (!shouldOverride) return currentCategory;

  if (s.includes('private line') || s.includes('wavelength') || s.includes('dark fiber')) {
    return 'Point-to-Point';
  }

  // No change for other types
  return currentCategory;
}

// Megaport scraping cache (24h)
let megaportCache: { data: Array<any>; updatedAt: number } | null = null;
const MEGAPORT_CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchMegaportLocationsLive(): Promise<Array<any>> {
  const url = "https://www.megaport.com/megaport-enabled-locations";
  const resp = await fetch(url, { headers: { "user-agent": "FiberAuditBot/1.0" } });
  if (!resp.ok) throw new Error(`Megaport page HTTP ${resp.status}`);
  const html = await resp.text();
  const $ = cheerio.load(html);

  const results: Array<{ id: string; name: string; city: string; country: string; lat?: number; lng?: number }> = [];

  // Heuristic 1: anchors or list items that look like "POP - City, Country"
  $("a, li, p, span").each((_: number, el: any) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    // e.g., "Equinix NYC1 - New York, United States"
    const match = text.match(/^(.*?)(?:\s*-\s*|\s+)([A-Za-z .]+),\s*([A-Za-z .]+)$/);
    if (match) {
      const [, left, cityPart, countryPart] = match;
      const city = cityPart.trim();
      const country = countryPart.trim();
      const name = left.trim();
      const id = `${city}-${name}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
      if (city && country && name && name.length <= 100 && city.length <= 100) {
        results.push({ id, name, city, country });
      }
    }
  });

  // Deduplicate by id
  const dedup = new Map<string, any>();
  for (const r of results) {
    if (!dedup.has(r.id)) dedup.set(r.id, r);
  }
  const data = Array.from(dedup.values());
  return data;
}

async function getMegaportLocations(opts?: { refresh?: boolean }): Promise<Array<any>> {
  const now = Date.now();
  if (!opts?.refresh && megaportCache && now - megaportCache.updatedAt < MEGAPORT_CACHE_MS) {
    // If cache exists but is empty (from a previous failed boot), ignore it and reload
    if (Array.isArray(megaportCache.data) && megaportCache.data.length === 0) {
      // fall through to reload
    } else {
      return megaportCache.data;
    }
  }

  // 1) Load static first so we always return something
  let staticData: any[] = [];
  try {
    const filePath = path.join(__dirname, "data", "megaport_locations.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    staticData = JSON.parse(raw);
    console.log(`[Megaport] Loaded static file`, filePath, `count=`, Array.isArray(staticData) ? staticData.length : 0);
  } catch (err) {
    console.error("Megaport static load failed:", err);
  }

  if (Array.isArray(staticData) && staticData.length > 0) {
    megaportCache = { data: staticData, updatedAt: now };
    // Serve static immediately to guarantee results
    return megaportCache.data;
  }

  // 2) Try to refresh with live scrape; if it fails, keep static
  try {
    const live = await fetchMegaportLocationsLive();
    if (Array.isArray(live) && live.length >= 20) {
      megaportCache = { data: live, updatedAt: now };
      return live;
    } else if (megaportCache) {
      console.warn(`Megaport live returned ${live?.length ?? 0} entries; serving cached/static (${megaportCache.data.length})`);
      return megaportCache.data;
    }
  } catch (e) {
    console.warn("Megaport live fetch failed; serving cached/static:", (e as any)?.message || e);
  }

  return megaportCache?.data || [];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Generic ping to confirm API routing
  app.get('/api/ping', (_req, res) => {
    res.type('text/plain').send('api-pong');
  });

  // Megaport POP locations (live with cache, fallback to static)
  // Simple static debug endpoint to verify file path and JSON load
  app.get("/api/megaport/ping", (_req, res) => {
    console.log("[Megaport] ping hit");
    res.type('text/plain').send('pong');
  });

  // Alternate test path to avoid any interference
  app.get("/api/megaport-test/ping", (_req, res) => {
    res.type('text/plain').send('megaport-test-pong');
  });

  app.get("/api/megaport/static", async (_req, res) => {
    try {
      console.log("[Megaport] static endpoint hit");
      const filePath = path.join(__dirname, "data", "megaport_locations.json");
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      res.json({ count: Array.isArray(data) ? data.length : 0, sample: Array.isArray(data) ? data.slice(0, 3) : [], path: filePath });
    } catch (e) {
      res.status(500).json({ error: (e as any)?.message });
    }
  });

  app.get("/api/megaport/locations", async (_req, res) => {
    try {
      const filePath = path.join(__dirname, "data", "megaport_locations.json");
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      res.json(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Megaport locations error:", error);
      res.status(500).json({ message: "Failed to load Megaport locations", error: (error as any)?.message });
    }
  });
  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      console.log('Creating project with data:', req.body);

      const name = (req.body?.name || '').toString().trim();
      if (!name) {
        return res.status(400).json({ message: "Project name is required" });
      }

      const projectData = {
        name,
        clientName: (req.body?.clientName || name).toString().trim(),
        status: (req.body?.status || 'active').toString(),
        createdBy: req.body?.createdBy || null,
      };

      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Project creation error:", error);
      res.status(500).json({ 
        message: "Failed to create project",
        error: (error as any)?.message 
      });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete project error:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Circuits
  app.get("/api/circuits", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      
      if (!projectId) {
        return res.json([]); // Return empty array if no project specified
      }
      
      let circuits = await storage.getCircuitsByProject(projectId);

      // Apply search filter if provided
      if (req.query.search && typeof req.query.search === 'string') {
        const searchLower = req.query.search.toLowerCase();
        circuits = circuits.filter(circuit =>
          circuit.siteName?.toLowerCase().includes(searchLower) ||
          circuit.circuitId?.toLowerCase().includes(searchLower) ||
          circuit.carrier?.toLowerCase().includes(searchLower)
        );
      }

      res.json(circuits);
    } catch (error) {
      console.error("Circuits fetch error:", error);
      res.status(500).json({ message: "Failed to fetch circuits" });
    }
  });

  app.get("/api/circuits/:id", async (req, res) => {
    try {
      const circuit = await storage.getCircuit(req.params.id);
      if (!circuit) {
        return res.status(404).json({ message: "Circuit not found" });
      }
      res.json(circuit);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch circuit" });
    }
  });

  app.post("/api/circuits", async (req, res) => {
    try {
      console.log('Creating circuit with data:', req.body);
      
      // Validate required fields
      if (!req.body.circuitId || !req.body.siteName || !req.body.projectId) {
        return res.status(400).json({ 
          message: "Missing required fields: circuitId, siteName, and projectId are required" 
        });
      }

      const circuitData = {
        ...req.body,
        status: req.body.status || 'active',
        optimizationStatus: req.body.optimizationStatus || 'pending',
        circuitCategory: req.body.circuitCategory || 'Internet',
        locationType: req.body.locationType || 'Branch',
        monthlyCost: req.body.monthlyCost?.toString() || '0',
        costPerMbps: req.body.costPerMbps?.toString() || '0',
        flags: req.body.flags || [],
        siteFeatures: req.body.siteFeatures || [],
      };
      // Auto-derive category from serviceType when applicable
      circuitData.circuitCategory = deriveCircuitCategory(circuitData.serviceType, circuitData.circuitCategory) || circuitData.circuitCategory;
      
      const circuit = await storage.createCircuit(circuitData);
      console.log('Circuit created successfully:', circuit.id);
      res.status(201).json(circuit);
    } catch (error) {
      console.error("Circuit creation error:", error);
      res.status(500).json({ 
        message: "Failed to create circuit", 
        error: (error as any)?.message 
      });
    }
  });

  app.patch("/api/circuits/:id", async (req, res) => {
    try {
      const circuit = await storage.updateCircuit(req.params.id, req.body);
      if (!circuit) {
        return res.status(404).json({ message: "Circuit not found" });
      }
      res.json(circuit);
    } catch (error) {
      console.error("Circuit update error:", error);
      res.status(500).json({ message: "Failed to update circuit" });
    }
  });

  app.delete("/api/circuits/:id", async (req, res) => {
    try {
      await storage.deleteCircuit(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete circuit" });
    }
  });

  app.patch("/api/circuits/bulk", async (req, res) => {
    try {
      const { ids, updates } = req.body;
      if (!Array.isArray(ids) || !updates) {
        return res.status(400).json({ message: "Invalid bulk update data" });
      }

      const updateData = updates;
      const circuits = await storage.bulkUpdateCircuits(ids, updateData);
      res.json(circuits);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid circuit data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to bulk update circuits" });
    }
  });

  // Circuit Import
  app.post("/api/circuits/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const projectId = req.body.projectId || "demo-project-1";
      const results: Array<any> = [];
      const errors: Array<{ row: number; message: string; data: any }> = [];
      let rowCount = 0;

      // Parse CSV data
      const csvStream = Readable.from(req.file.buffer.toString());

      await new Promise((resolve, reject) => {
        csvStream
          .pipe(csv())
          .on("data", (data) => {
            rowCount++;
            results.push({ ...data, rowNumber: rowCount });
          })
          .on("end", resolve)
          .on("error", reject);
      });

      // Process each row
      const successfulImports = [];

      for (const row of results) {
        try {
          // Map CSV columns to our schema
          const bandwidthMbps = parseInt(row["Bandwidth Mbps"] || row["bandwidth_mbps"] || "0");
          const monthlyCost = parseFloat(row["Monthly Cost"] || row["monthly_cost"] || "0");

          const circuitData = {
            circuitId: row["Circuit ID"] || row["circuit_id"] || "",
            projectId,
            siteName: row["Site Name"] || row["site_name"] || "",
            carrier: row["Carrier"] || row["carrier"] || "",
            locationType: row["Location Type"] || row["location_type"] || "Branch",
            serviceType: row["Service Type"] || row["service_type"] || "",
            circuitCategory: row["Circuit Category"] || row["circuit_category"] || "Internet",
            aLocation: row["A Location"] || row["a_location"] || null,
            zLocation: row["Z Location"] || row["z_location"] || null,
            bandwidth: row["Bandwidth"] || row["bandwidth"] || "",
            bandwidthMbps,
            monthlyCost: monthlyCost.toString(),
            costPerMbps: (bandwidthMbps > 0 ? (monthlyCost / bandwidthMbps) : 0).toString(),
            contractTerm: row["Contract Term"] || row["contract_term"] || null,
            contractEndDate: row["Contract End Date"] ? new Date(row["Contract End Date"]) : null,
            status: row["Status"] || row["status"] || "active",
            optimizationStatus: row["Optimization Status"] || row["optimization_status"] || "pending",
            notes: row["Notes"] || row["notes"] || null,
            flags: [],
            siteFeatures: [],
          };
          // Auto-derive category from serviceType when applicable
          circuitData.circuitCategory = deriveCircuitCategory(circuitData.serviceType, circuitData.circuitCategory) || circuitData.circuitCategory;

          // Save to database
          const circuit = await storage.createCircuit(circuitData);
          successfulImports.push(circuit);

        } catch (error) {
          errors.push({
            row: row.rowNumber,
            message: error instanceof Error ? error.message : "Unknown error",
            data: row
          });
        }
      }

      res.json({
        success: successfulImports.length,
        errors: errors
      });

    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Failed to process import" });
    }
  });

  // Audit Flags
  app.get("/api/audit-flags", async (req, res) => {
    try {
      const { circuitId } = req.query;
      const flags = await storage.getAuditFlags(circuitId as string | undefined);
      res.json(flags);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit flags" });
    }
  });

  app.post("/api/audit-flags", async (req, res) => {
    try {
      const flagData = {
        ...req.body,
        severity: req.body.severity || 'medium',
        isResolved: req.body.isResolved || false,
        resolvedAt: req.body.resolvedAt || null,
      };
      const flag = await storage.createAuditFlag(flagData);
      res.status(201).json(flag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid flag data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create audit flag" });
    }
  });

  app.patch("/api/audit-flags/:id", async (req, res) => {
    try {
      const updateData = req.body;
      const flag = await storage.updateAuditFlag(req.params.id, updateData);
      res.json(flag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid flag data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update audit flag" });
    }
  });

  app.delete("/api/audit-flags/:id", async (req, res) => {
    try {
      await storage.deleteAuditFlag(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete audit flag" });
    }
  });

  // Analytics
  app.get("/api/projects/:id/metrics", async (req, res) => {
    try {
      const metrics = await storage.getProjectMetrics(req.params.id);
      res.json(metrics);
    } catch (error) {
      console.error("Project metrics error:", error);
      res.status(500).json({ message: "Failed to fetch project metrics" });
    }
  });

  // Site management endpoints
  app.get("/api/sites", async (req, res) => {
    try {
      const { projectId } = req.query;
      if (!projectId || typeof projectId !== "string" || !projectId.trim()) {
        return res.status(400).json({
          message: "projectId query parameter is required to list sites",
        });
      }

      const scopedSites = await storage.getSitesByProject(projectId as string);
      res.json(scopedSites);
    } catch (error) {
      console.error("Get sites error:", error);
      res.status(500).json({ message: "Failed to fetch sites" });
    }
  });

  app.post("/api/sites", async (req, res) => {
    try {
      console.log('Creating site with data:', req.body);

      const { name, location, category, projectId } = req.body || {};

      // Basic validation for required fields
      if (!name || !location || !category || !projectId) {
        return res.status(400).json({
          message: "Missing required fields: name, location, category, and projectId are required",
        });
      }

      // Ensure project exists before creating a site under it (storage-based)
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(400).json({ message: "Invalid projectId: project not found" });
      }

      const site = await storage.createSite({ ...req.body, projectId });
      console.log('Site created successfully:', site.id);
      res.status(201).json(site);
    } catch (error) {
      console.error("Create site error:", error);
      res.status(500).json({ message: "Failed to create site", error: (error as any)?.message });
    }
  });

  app.patch("/api/sites/:id", async (req, res) => {
    try {
      const site = await storage.updateSite(req.params.id, req.body);
      if (!site) {
        return res.status(404).json({ message: "Site not found" });
      }
      res.json(site);
    } catch (error) {
      console.error("Update site error:", error);
      res.status(500).json({ message: "Failed to update site" });
    }
  });

  app.delete("/api/sites/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteSite(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Site not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete site error:", error);
      res.status(500).json({ message: "Failed to delete site" });
    }
  });

  // Get project sites
  app.get('/api/projects/:projectId/sites', async (req, res) => {
    try {
      const { projectId } = req.params;
      const projectSites = await storage.getSitesByProject(projectId);
      res.json(projectSites);
    } catch (error) {
      console.error('Error fetching sites:', error);
      res.status(500).json({ error: 'Failed to fetch sites' });
    }
  });

  // Maintenance: Recalculate Megaport proximity for all sites with coordinates
  app.post('/api/maintenance/recalc-megaport', async (_req, res) => {
    try {
      const allSites = await storage.getAllSites();
      let updated = 0;
      for (const s of allSites) {
        if (s && s.id && s.latitude != null && s.longitude != null) {
          // Trigger recalculation by sending current coordinates as an update
          const result = await storage.updateSite(s.id, {
            latitude: s.latitude as number,
            longitude: s.longitude as number,
          } as any);
          if (result) updated++;
        }
      }
      res.json({ success: true, updated });
    } catch (error) {
      console.error('Recalc Megaport error:', error);
      res.status(500).json({ success: false, message: 'Failed to recalc Megaport proximity' });
    }
  });

  // Cloud Apps
  app.get("/api/cloud-apps", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.json([]);
      const apps = await storage.getCloudAppsByProject(projectId);
      res.json(apps);
    } catch (error) {
      console.error("Cloud apps fetch error:", error);
      res.status(500).json({ message: "Failed to fetch cloud apps" });
    }
  });

  app.get("/api/cloud-apps/:id", async (req, res) => {
    try {
      const appItem = await storage.getCloudApp(req.params.id);
      if (!appItem) return res.status(404).json({ message: "Cloud app not found" });
      res.json(appItem);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cloud app" });
    }
  });

  app.post("/api/cloud-apps", async (req, res) => {
    try {
      const parse = insertCloudAppSchema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid cloud app data", errors: parse.error.errors });
      }

      const body = parse.data as any;
      const normalizeProvider = (p?: string | null) => {
        const s = (p || '').trim().toLowerCase();
        if (!s) return null;
        if (s === 'amazon' || s.includes('amazon web services') || s === 'aws') return 'AWS';
        if (s === 'azure' || s.includes('microsoft azure')) return 'Azure';
        if (s.includes('google cloud') || s === 'gcp' || s === 'google') return 'Google Cloud';
        if (s.includes('microsoft 365') || s.includes('office 365') || s === 'o365') return 'Microsoft 365';
        if (s.includes('google workspace') || s.includes('g suite')) return 'Google Workspace';
        return p?.trim() || null;
      };

      const appData = {
        ...body,
        name: (body.name || '').toString().trim(),
        provider: normalizeProvider(body.provider ? body.provider.toString() : null),
        category: body.category || 'SaaS',
        appType: body.appType ? body.appType.toString() : null,
        monthlyCost: (body.monthlyCost ?? '0').toString(),
        status: body.status || 'active',
      };

      if (!appData.projectId || !appData.name) {
        return res.status(400).json({ message: "projectId and name are required" });
      }

      const created = await storage.createCloudApp(appData);
      res.status(201).json(created);
    } catch (error) {
      console.error("Cloud app creation error:", error);
      res.status(500).json({ message: "Failed to create cloud app", error: (error as any)?.message });
    }
  });

  app.patch("/api/cloud-apps/:id", async (req, res) => {
    try {
      const normalizeProvider = (p?: string | null) => {
        const s = (p || '').trim().toLowerCase();
        if (!s) return null;
        if (s === 'amazon' || s.includes('amazon web services') || s === 'aws') return 'AWS';
        if (s === 'azure' || s.includes('microsoft azure')) return 'Azure';
        if (s.includes('google cloud') || s === 'gcp' || s === 'google') return 'Google Cloud';
        if (s.includes('microsoft 365') || s.includes('office 365') || s === 'o365') return 'Microsoft 365';
        if (s.includes('google workspace') || s.includes('g suite')) return 'Google Workspace';
        return p?.trim() || null;
      };

      const updateBody = { ...req.body };
      if (typeof updateBody.provider !== 'undefined') {
        updateBody.provider = normalizeProvider(updateBody.provider);
      }

      const updated = await storage.updateCloudApp(req.params.id, updateBody);
      if (!updated) return res.status(404).json({ message: "Cloud app not found" });
      res.json(updated);
    } catch (error) {
      console.error("Cloud app update error:", error);
      res.status(500).json({ message: "Failed to update cloud app" });
    }
  });

  app.delete("/api/cloud-apps/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCloudApp(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Cloud app not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Cloud app delete error:", error);
      res.status(500).json({ message: "Failed to delete cloud app" });
    }
  });

  // Project-scoped cloud apps
  app.get('/api/projects/:projectId/cloud-apps', async (req, res) => {
    try {
      const { projectId } = req.params;
      const apps = await storage.getCloudAppsByProject(projectId);
      res.json(apps);
    } catch (error) {
      console.error('Error fetching cloud apps:', error);
      res.status(500).json({ error: 'Failed to fetch cloud apps' });
    }
  });

  // Get project circuits
  app.get('/api/projects/:projectId/circuits', async (req, res) => {
    try {
      const { projectId } = req.params;
      const projectCircuits = await storage.getCircuitsByProject(projectId);
      res.json(projectCircuits);
    } catch (error) {
      console.error('Error fetching circuits:', error);
      res.status(500).json({ error: 'Failed to fetch circuits' });
    }
  });

  // Address validation endpoint
  app.post("/api/addresses/validate", async (req, res) => {
    try {
      const { handleAddressValidation } = await import("./address-validation");
      await handleAddressValidation(req, res);
    } catch (error) {
      console.error('Error loading address validation:', error);
      res.status(500).json({ error: "Address validation service unavailable" });
    }
  });

  // Driving distance (OpenRouteService) endpoint
  try {
    const distanceModule = await import("./routes/distance");
    const distanceRouter = distanceModule.default;
    app.use('/api', distanceRouter);
  } catch (error) {
    console.warn('Distance router unavailable:', (error as any)?.message || error);
  }

  const httpServer = createServer(app);
  return httpServer;
}