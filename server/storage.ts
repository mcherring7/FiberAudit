import { users, projects, circuits, auditFlags, sites, type User, type Project, type Circuit, type AuditFlag, type Site, type InsertSite, type InsertProject } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db } from "./db";

// Storage interface definition
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Project operations
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  updateProject(id: string, project: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Circuit operations
  getCircuit(id: string): Promise<Circuit | undefined>;
  getAllCircuits(): Promise<Circuit[]>;
  getCircuitsByProject(projectId: string): Promise<Circuit[]>;
  createCircuit(circuit: Omit<Circuit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Circuit>;
  updateCircuit(id: string, circuit: Partial<Circuit>): Promise<Circuit | undefined>;
  deleteCircuit(id: string): Promise<boolean>;
  bulkUpdateCircuits(ids: string[], updates: Partial<Circuit>): Promise<Circuit[]>;

  // Audit flag operations
  getAuditFlag(id: string): Promise<AuditFlag | undefined>;
  getAllAuditFlags(): Promise<AuditFlag[]>;
  getAuditFlags(circuitId?: string): Promise<AuditFlag[]>;
  getAuditFlagsByCircuit(circuitId: string): Promise<AuditFlag[]>;
  createAuditFlag(flag: Omit<AuditFlag, 'id' | 'createdAt'>): Promise<AuditFlag>;
  updateAuditFlag(id: string, flag: Partial<AuditFlag>): Promise<AuditFlag | undefined>;
  deleteAuditFlag(id: string): Promise<boolean>;

  // Project metrics
  getProjectMetrics(projectId: string): Promise<any>;

  // Site operations
  getSite(id: string): Promise<Site | undefined>;
  getAllSites(): Promise<Site[]>;
  getSitesByProject(projectId: string): Promise<Site[]>;
  createSite(site: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>): Promise<Site>;
  updateSite(id: string, site: Partial<Site>): Promise<Site | undefined>;
  deleteSite(id: string): Promise<boolean>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // Seed some default users if none exist
  private async seedDefaultUsers(): Promise<void> {
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length === 0) {
      await db.insert(users).values([
        {
          id: "user-1",
          username: "matthew",
          password: "password123",
          name: "Matthew",
          role: "consultant"
        },
        {
          id: "user-2",
          username: "tim",
          password: "password123",
          name: "Tim",
          role: "consultant"
        }
      ]);
    }
  }

  constructor() {
    this.seedDefaultUsers().catch(console.error);
    console.log('Storage initialized');
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        id: crypto.randomUUID(),
        createdAt: new Date()
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Project operations
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    // Ensure createdBy (FK) points to an existing user; otherwise set to null to avoid FK violation
    let safeCreatedBy = (projectData as any).createdBy as string | null | undefined;
    if (safeCreatedBy) {
      const user = await this.getUser(safeCreatedBy);
      if (!user) {
        safeCreatedBy = null;
      }
    }

    const [project] = await db
      .insert(projects)
      .values({
        ...projectData,
        createdBy: safeCreatedBy ?? null,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return project;
  }

  async updateProject(id: string, projectData: Partial<Project>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...projectData, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Circuit operations
  async getCircuit(id: string): Promise<Circuit | undefined> {
    const [circuit] = await db.select().from(circuits).where(eq(circuits.id, id));
    return circuit || undefined;
  }

  async getAllCircuits(): Promise<Circuit[]> {
    return await db.select().from(circuits);
  }

  async getCircuitsByProject(projectId: string): Promise<Circuit[]> {
    return await db.select().from(circuits).where(eq(circuits.projectId, projectId));
  }

  async createCircuit(circuitData: Omit<Circuit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Circuit> {
    const [circuit] = await db
      .insert(circuits)
      .values({
        ...circuitData,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Update project's lastModified when a circuit is added
    if (circuitData.projectId) {
      await this.updateProject(circuitData.projectId, { updatedAt: new Date() });
    }

    return circuit;
  }

  async updateCircuit(id: string, circuitData: Partial<Circuit>): Promise<Circuit | undefined> {
    // Get the circuit first to find its project
    const existingCircuit = await this.getCircuit(id);

    const [circuit] = await db
      .update(circuits)
      .set({ ...circuitData, updatedAt: new Date() })
      .where(eq(circuits.id, id))
      .returning();

    // Update project's lastModified when a circuit is updated
    if (circuit && existingCircuit?.projectId) {
      await this.updateProject(existingCircuit.projectId, { updatedAt: new Date() });
    }

    return circuit || undefined;
  }

  async deleteCircuit(id: string): Promise<boolean> {
    // Get the circuit first to find its project
    const existingCircuit = await this.getCircuit(id);

    const result = await db.delete(circuits).where(eq(circuits.id, id));
    const success = (result.rowCount ?? 0) > 0;

    // Update project's lastModified when a circuit is deleted
    if (success && existingCircuit?.projectId) {
      await this.updateProject(existingCircuit.projectId, { updatedAt: new Date() });
    }

    return success;
  }

  async bulkUpdateCircuits(ids: string[], updates: Partial<Circuit>): Promise<Circuit[]> {
    const updatedCircuits: Circuit[] = [];
    for (const id of ids) {
      const circuit = await this.updateCircuit(id, updates);
      if (circuit) updatedCircuits.push(circuit);
    }
    return updatedCircuits;
  }

  // Audit flag operations
  async getAuditFlag(id: string): Promise<AuditFlag | undefined> {
    const [flag] = await db.select().from(auditFlags).where(eq(auditFlags.id, id));
    return flag || undefined;
  }

  async getAllAuditFlags(): Promise<AuditFlag[]> {
    return await db.select().from(auditFlags);
  }

  async getAuditFlags(circuitId?: string): Promise<AuditFlag[]> {
    if (circuitId) {
      return await db.select().from(auditFlags).where(eq(auditFlags.circuitId, circuitId));
    }
    return await db.select().from(auditFlags);
  }

  async getAuditFlagsByCircuit(circuitId: string): Promise<AuditFlag[]> {
    return await db.select().from(auditFlags).where(eq(auditFlags.circuitId, circuitId));
  }

  async createAuditFlag(flagData: Omit<AuditFlag, 'id' | 'createdAt'>): Promise<AuditFlag> {
    const [flag] = await db
      .insert(auditFlags)
      .values({
        ...flagData,
        id: crypto.randomUUID(),
        createdAt: new Date()
      })
      .returning();
    return flag;
  }

  async updateAuditFlag(id: string, flagData: Partial<AuditFlag>): Promise<AuditFlag | undefined> {
    const [flag] = await db
      .update(auditFlags)
      .set(flagData)
      .where(eq(auditFlags.id, id))
      .returning();
    return flag || undefined;
  }

  async deleteAuditFlag(id: string): Promise<boolean> {
    const result = await db.delete(auditFlags).where(eq(auditFlags.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getProjectMetrics(projectId: string): Promise<any> {
    const projectCircuits = await this.getCircuitsByProject(projectId);
    const totalCircuits = projectCircuits.length;
    
    // Calculate total monthly cost ONLY from circuit inventory
    const totalMonthlyCost = projectCircuits.reduce((sum, circuit) => {
      const cost = typeof circuit.monthlyCost === 'string' 
        ? parseFloat(circuit.monthlyCost) 
        : circuit.monthlyCost;
      return sum + (isNaN(cost) ? 0 : cost);
    }, 0);
    
    // Calculate average cost per Mbps from circuits only
    const averageCostPerMbps = projectCircuits.length > 0 
      ? projectCircuits.reduce((sum, circuit) => {
          const costPerMbps = typeof circuit.costPerMbps === 'string' 
            ? parseFloat(circuit.costPerMbps) 
            : circuit.costPerMbps;
          return sum + (isNaN(costPerMbps) ? 0 : costPerMbps);
        }, 0) / projectCircuits.length 
      : 0;

    // Calculate optimization opportunities based on high cost per Mbps circuits (above $30/Mbps)
    const highCostCircuits = projectCircuits.filter(circuit => {
      const costPerMbps = typeof circuit.costPerMbps === 'string' 
        ? parseFloat(circuit.costPerMbps) 
        : circuit.costPerMbps;
      return !isNaN(costPerMbps) && costPerMbps > 30;
    }).length;
    
    const optimizationOpportunities = Math.max(highCostCircuits, Math.floor(totalCircuits * 0.15));

    return {
      totalCircuits,
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      averageCostPerMbps: Math.round(averageCostPerMbps * 100) / 100,
      optimizationOpportunities,
      highCostCircuits,
      circuitTypes: projectCircuits.reduce((acc, circuit) => {
        const serviceType = circuit.serviceType || 'Unknown';
        acc[serviceType] = (acc[serviceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  // Site operations
  async getSite(id: string): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id));
    return site || undefined;
  }

  async getAllSites(): Promise<Site[]> {
    try {
      return await db.select().from(sites);
    } catch (error) {
      console.error('Error getting all sites:', error);
      throw error;
    }
  }

  async getSitesByProject(projectId: string): Promise<Site[]> {
    try {
      return await db.select().from(sites).where(eq(sites.projectId, projectId));
    } catch (error) {
      console.error('Error getting sites by project:', error);
      throw error;
    }
  }

  async createSite(siteData: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>): Promise<Site> {
    try {
      const site = {
        ...siteData,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const [createdSite] = await db.insert(sites).values(site).returning();
      return createdSite;
    } catch (error) {
      console.error('Error creating site:', error);
      throw error;
    }
  }

  async updateSite(id: string, siteData: Partial<Site>): Promise<Site | undefined> {
    // Check if address-related fields are being updated
    const addressFieldsUpdated = !!(
      siteData.streetAddress || 
      siteData.city || 
      siteData.state || 
      siteData.postalCode || 
      siteData.latitude || 
      siteData.longitude
    );

    const updateData: Partial<Site> = { 
      ...siteData, 
      updatedAt: new Date() 
    };

    // Get current site for calculations
    const currentSite = await this.getSite(id);
    if (!currentSite) {
      console.warn(`Site with id ${id} not found for update.`);
      return undefined;
    }

    // Recalculate Megaport proximity if address changed and we have coordinates
    if (addressFieldsUpdated) {
      const latitude = siteData.latitude ?? currentSite.latitude;
      const longitude = siteData.longitude ?? currentSite.longitude;

      if (latitude !== null && longitude !== null) {
        const megaportProximity = this.calculateNearestMegaportPOP(latitude, longitude);
        updateData.nearestMegaportPop = megaportProximity.popName;
        updateData.megaportDistance = megaportProximity.distance;
      } else {
        // Clear Megaport data if address fields are updated but coordinates are missing
        updateData.nearestMegaportPop = null;
        updateData.megaportDistance = null;
      }
    }

    const [site] = await db
      .update(sites)
      .set(updateData)
      .where(eq(sites.id, id))
      .returning();
      
    if (!site) {
      console.warn(`Site with id ${id} not found for update, or no changes were made.`);
      return undefined;
    }
    return site;
  }

  async deleteSite(id: string): Promise<boolean> {
    try {
      const result = await db.delete(sites).where(eq(sites.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error(`Error deleting site with id ${id}:`, error);
      throw error;
    }
  }

  // Helper method to calculate nearest Megaport POP
  private calculateNearestMegaportPOP(latitude: number, longitude: number): { popName: string; distance: number } {
    // Megaport POP locations (approximate coordinates)
    const megaportPOPs = [
      { name: "NYC1 - New York", lat: 40.7128, lng: -74.0060 },
      { name: "CHI1 - Chicago", lat: 41.8781, lng: -87.6298 },
      { name: "DFW1 - Dallas", lat: 32.7767, lng: -96.7970 },
      { name: "LAX1 - Los Angeles", lat: 34.0522, lng: -118.2437 },
      { name: "SJC1 - San Jose", lat: 37.3382, lng: -121.8863 },
      { name: "MIA1 - Miami", lat: 25.7617, lng: -80.1918 },
      { name: "HOU1 - Houston", lat: 29.7604, lng: -95.3698 },
      { name: "RES1 - Reston", lat: 38.9587, lng: -77.3570 }
    ];

    let nearestPOP = megaportPOPs[0];
    let minDistance = this.calculateDistance(latitude, longitude, nearestPOP.lat, nearestPOP.lng);

    for (const pop of megaportPOPs) {
      const distance = this.calculateDistance(latitude, longitude, pop.lat, pop.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPOP = pop;
      }
    }

    return {
      popName: nearestPOP.name,
      distance: Math.round(minDistance * 10) / 10 // Round to 1 decimal place
    };
  }

  // Helper method to calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const storage = new DatabaseStorage();