import { 
  users, projects, circuits, auditFlags,
  type User, type InsertUser,
  type Project, type InsertProject,
  type Circuit, type InsertCircuit,
  type AuditFlag, type InsertAuditFlag
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project>;

  // Circuits
  getCircuits(projectId?: string, searchQuery?: string): Promise<Circuit[]>;
  getCircuit(id: string): Promise<Circuit | undefined>;
  createCircuit(circuit: InsertCircuit): Promise<Circuit>;
  updateCircuit(id: string, updates: Partial<InsertCircuit>): Promise<Circuit>;
  deleteCircuit(id: string): Promise<void>;
  bulkUpdateCircuits(ids: string[], updates: Partial<InsertCircuit>): Promise<Circuit[]>;

  // Audit Flags
  getAuditFlags(circuitId?: string): Promise<AuditFlag[]>;
  createAuditFlag(flag: InsertAuditFlag): Promise<AuditFlag>;
  updateAuditFlag(id: string, updates: Partial<InsertAuditFlag>): Promise<AuditFlag>;
  deleteAuditFlag(id: string): Promise<void>;

  // Analytics
  getProjectMetrics(projectId: string): Promise<{
    totalCost: number;
    circuitCount: number;
    highCostCircuits: number;
    opportunities: number;
    avgCostPerMbps: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const [updatedProject] = await db
      .update(projects)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }

  // Circuits
  async getCircuits(projectId?: string, searchQuery?: string): Promise<Circuit[]> {
    let query = db.select().from(circuits);
    
    const conditions = [];
    if (projectId) {
      conditions.push(eq(circuits.projectId, projectId));
    }
    
    if (searchQuery) {
      conditions.push(
        or(
          ilike(circuits.circuitId, `%${searchQuery}%`),
          ilike(circuits.carrier, `%${searchQuery}%`),
          ilike(circuits.location, `%${searchQuery}%`),
          ilike(circuits.serviceType, `%${searchQuery}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(circuits.createdAt));
  }

  async getCircuit(id: string): Promise<Circuit | undefined> {
    const [circuit] = await db.select().from(circuits).where(eq(circuits.id, id));
    return circuit || undefined;
  }

  async createCircuit(circuit: InsertCircuit): Promise<Circuit> {
    const [newCircuit] = await db.insert(circuits).values(circuit).returning();
    return newCircuit;
  }

  async updateCircuit(id: string, updates: Partial<InsertCircuit>): Promise<Circuit> {
    const [updatedCircuit] = await db
      .update(circuits)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(circuits.id, id))
      .returning();
    return updatedCircuit;
  }

  async deleteCircuit(id: string): Promise<void> {
    await db.delete(circuits).where(eq(circuits.id, id));
  }

  async bulkUpdateCircuits(ids: string[], updates: Partial<InsertCircuit>): Promise<Circuit[]> {
    const updatedCircuits = await db
      .update(circuits)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(sql`${circuits.id} = ANY(${ids})`)
      .returning();
    return updatedCircuits;
  }

  // Audit Flags
  async getAuditFlags(circuitId?: string): Promise<AuditFlag[]> {
    let query = db.select().from(auditFlags);
    
    if (circuitId) {
      query = query.where(eq(auditFlags.circuitId, circuitId));
    }

    return await query.orderBy(desc(auditFlags.createdAt));
  }

  async createAuditFlag(flag: InsertAuditFlag): Promise<AuditFlag> {
    const [newFlag] = await db.insert(auditFlags).values(flag).returning();
    return newFlag;
  }

  async updateAuditFlag(id: string, updates: Partial<InsertAuditFlag>): Promise<AuditFlag> {
    const [updatedFlag] = await db
      .update(auditFlags)
      .set(updates)
      .where(eq(auditFlags.id, id))
      .returning();
    return updatedFlag;
  }

  async deleteAuditFlag(id: string): Promise<void> {
    await db.delete(auditFlags).where(eq(auditFlags.id, id));
  }

  // Analytics
  async getProjectMetrics(projectId: string): Promise<{
    totalCost: number;
    circuitCount: number;
    highCostCircuits: number;
    opportunities: number;
    avgCostPerMbps: number;
  }> {
    const projectCircuits = await db
      .select()
      .from(circuits)
      .where(eq(circuits.projectId, projectId));

    const totalCost = projectCircuits.reduce((sum, circuit) => 
      sum + parseFloat(circuit.monthlyCost), 0);
    
    const circuitCount = projectCircuits.length;
    
    const avgCostPerMbps = projectCircuits.length > 0
      ? projectCircuits.reduce((sum, circuit) => 
          sum + parseFloat(circuit.costPerMbps), 0) / projectCircuits.length
      : 0;

    // High cost circuits: above $10/Mbps
    const highCostCircuits = projectCircuits.filter(circuit => 
      parseFloat(circuit.costPerMbps) > 10).length;

    // Opportunities: circuits flagged for optimization
    const opportunities = projectCircuits.filter(circuit => 
      circuit.optimizationStatus === 'opportunity').length;

    return {
      totalCost,
      circuitCount,
      highCostCircuits,
      opportunities,
      avgCostPerMbps
    };
  }
}

export const storage = new DatabaseStorage();
