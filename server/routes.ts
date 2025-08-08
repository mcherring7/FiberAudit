import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertCircuitSchema, insertAuditFlagSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });
  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
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
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Circuits
  app.get("/api/circuits", async (req, res) => {
    try {
      const { projectId, search } = req.query;
      const circuits = await storage.getCircuits(
        projectId as string | undefined,
        search as string | undefined
      );
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
      const circuitData = insertCircuitSchema.parse(req.body);
      const circuit = await storage.createCircuit(circuitData);
      res.status(201).json(circuit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid circuit data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create circuit" });
    }
  });

  app.patch("/api/circuits/:id", async (req, res) => {
    try {
      const updateData = insertCircuitSchema.partial().parse(req.body);
      const circuit = await storage.updateCircuit(req.params.id, updateData);
      res.json(circuit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid circuit data", errors: error.errors });
      }
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
      
      const updateData = insertCircuitSchema.partial().parse(updates);
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
          };

          // Validate the data
          const validatedData = insertCircuitSchema.parse(circuitData);
          
          // Save to database
          const circuit = await storage.createCircuit(validatedData);
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
      const flagData = insertAuditFlagSchema.parse(req.body);
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
      const updateData = insertAuditFlagSchema.partial().parse(req.body);
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
      res.status(500).json({ message: "Failed to fetch project metrics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
