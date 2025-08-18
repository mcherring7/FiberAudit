import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertCircuitSchema, insertAuditFlagSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { db } from "./db"; // Assuming db is imported from './db'
import { eq } from "drizzle-orm"; // Assuming eq is imported from 'drizzle-orm'
import { sitesTable, circuitsTable } from "@shared/schema"; // Assuming tables are imported from '@shared/schema'

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
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
      const projectData = {
        name: req.body.name,
        clientName: req.body.clientName || req.body.name, // Use name as clientName if not provided
        status: req.body.status || 'active',
        createdBy: req.body.createdBy || null,
      };
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      console.error("Project creation error:", error);
      res.status(500).json({ message: "Failed to create project" });
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
      let circuits = await storage.getCircuits(projectId);

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
      const circuitData = {
        ...req.body,
        status: req.body.status || 'active',
        optimizationStatus: req.body.optimizationStatus || 'pending',
        circuitCategory: req.body.circuitCategory || 'Internet',
        locationType: req.body.locationType || 'Branch',
        monthlyCost: req.body.monthlyCost?.toString() || '0',
        costPerMbps: req.body.costPerMbps?.toString() || '0',
        flags: req.body.flags || [],
      };
      const circuit = await storage.createCircuit(circuitData);
      res.status(201).json(circuit);
    } catch (error) {
      res.status(500).json({ message: "Failed to create circuit" });
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
            monthlyCost,
            costPerMbps: bandwidthMbps > 0 ? monthlyCost / bandwidthMbps : 0,
            contractTerm: row["Contract Term"] || row["contract_term"] || null,
            contractEndDate: row["Contract End Date"] ? new Date(row["Contract End Date"]) : null,
            status: row["Status"] || row["status"] || "active",
            optimizationStatus: row["Optimization Status"] || row["optimization_status"] || "pending",
            notes: row["Notes"] || row["notes"] || null,
            flags: [],
            siteFeatures: [],
          };

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
      let sites;

      if (projectId) {
        sites = await storage.getSitesByProject(projectId as string);
      } else {
        sites = await storage.getAllSites();
      }

      res.json(sites);
    } catch (error) {
      console.error("Get sites error:", error);
      res.status(500).json({ message: "Failed to fetch sites" });
    }
  });

  app.post("/api/sites", async (req, res) => {
    try {
      const site = await storage.createSite(req.body);
      res.status(201).json(site);
    } catch (error) {
      console.error("Create site error:", error);
      res.status(500).json({ message: "Failed to create site" });
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
      const sites = await db.select().from(sitesTable).where(eq(sitesTable.projectId, projectId));
      res.json(sites);
    } catch (error) {
      console.error('Error fetching sites:', error);
      res.status(500).json({ error: 'Failed to fetch sites' });
    }
  });

  // Get project circuits
  app.get('/api/projects/:projectId/circuits', async (req, res) => {
    try {
      const { projectId } = req.params;
      const circuits = await db.select().from(circuitsTable).where(eq(circuitsTable.projectId, projectId));
      res.json(circuits);
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

  const httpServer = createServer(app);
  return httpServer;
}