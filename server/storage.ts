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
          ilike(circuits.siteName, `%${searchQuery}%`),
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

// In-memory storage implementation with sample data
export class MemStorage implements IStorage {
  private users: User[] = [];
  private projects: Project[] = [];
  private circuits: Circuit[] = [];
  private auditFlags: AuditFlag[] = [];

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample project
    const sampleProject: Project = {
      id: 'demo-project-1',
      name: 'Demo Telecom Project',
      clientName: 'Sample Corporation',
      status: 'active',
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.projects.push(sampleProject);

    // Sample circuits
    const sampleCircuits: Circuit[] = [
      {
        id: 'circuit-1',
        circuitId: 'CKT-NYC-001',
        projectId: 'demo-project-1',
        siteName: 'New York HQ',
        carrier: 'Verizon',
        locationType: 'Corporate',
        serviceType: 'Dedicated Internet',
        circuitCategory: 'Internet',
        aLocation: null,
        zLocation: null,
        bandwidth: '1 Gbps',
        bandwidthMbps: 1000,
        monthlyCost: '2500.00',
        costPerMbps: '2.50',
        contractTerm: '36 months',
        contractEndDate: new Date('2025-12-31'),
        status: 'active',
        optimizationStatus: 'pending',
        notes: null,
        flags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'circuit-2',
        circuitId: 'CKT-CHI-001',
        projectId: 'demo-project-1',
        siteName: 'Chicago Branch',
        carrier: 'Comcast',
        locationType: 'Branch',
        serviceType: 'Broadband',
        circuitCategory: 'Internet',
        aLocation: null,
        zLocation: null,
        bandwidth: '100 Mbps',
        bandwidthMbps: 100,
        monthlyCost: '150.00',
        costPerMbps: '1.50',
        contractTerm: '24 months',
        contractEndDate: new Date('2025-06-30'),
        status: 'active',
        optimizationStatus: 'opportunity',
        notes: 'Consider upgrade to fiber',
        flags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'circuit-3',
        circuitId: 'CKT-MPLS-001',
        projectId: 'demo-project-1',
        siteName: 'Los Angeles Office',
        carrier: 'AT&T',
        locationType: 'Branch',
        serviceType: 'MPLS',
        circuitCategory: 'Private',
        aLocation: null,
        zLocation: null,
        bandwidth: '50 Mbps',
        bandwidthMbps: 50,
        monthlyCost: '800.00',
        costPerMbps: '16.00',
        contractTerm: '24 months',
        contractEndDate: new Date('2024-12-31'),
        status: 'active',
        optimizationStatus: 'opportunity',
        notes: 'High cost per Mbps - consider alternatives',
        flags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'circuit-4',
        circuitId: 'CKT-DC-001',
        projectId: 'demo-project-1',
        siteName: 'Primary Data Center',
        carrier: 'CenturyLink',
        locationType: 'Data Center',
        serviceType: 'Dark Fiber',
        circuitCategory: 'Point-to-Point',
        aLocation: 'Primary Data Center',
        zLocation: 'Secondary Data Center',
        bandwidth: '10 Gbps',
        bandwidthMbps: 10000,
        monthlyCost: '5000.00',
        costPerMbps: '0.50',
        contractTerm: '60 months',
        contractEndDate: new Date('2026-12-31'),
        status: 'active',
        optimizationStatus: 'pending',
        notes: 'Critical infrastructure link',
        flags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'circuit-5',
        circuitId: 'CKT-AWS-001',
        projectId: 'demo-project-1',
        siteName: 'AWS Direct Connect',
        carrier: 'Equinix',
        locationType: 'Cloud',
        serviceType: 'Direct Connect',
        circuitCategory: 'Internet',
        aLocation: null,
        zLocation: null,
        bandwidth: '1 Gbps',
        bandwidthMbps: 1000,
        monthlyCost: '750.00',
        costPerMbps: '0.75',
        contractTerm: '12 months',
        contractEndDate: new Date('2025-03-31'),
        status: 'active',
        optimizationStatus: 'pending',
        notes: 'AWS Direct Connect for hybrid cloud',
        flags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    this.circuits.push(...sampleCircuits);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: `user-${Date.now()}`,
      ...user,
      createdAt: new Date()
    };
    this.users.push(newUser);
    return newUser;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return [...this.projects].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.find(p => p.id === id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const newProject: Project = {
      id: `project-${Date.now()}`,
      ...project,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.projects.push(newProject);
    return newProject;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const projectIndex = this.projects.findIndex(p => p.id === id);
    if (projectIndex === -1) {
      throw new Error('Project not found');
    }
    
    this.projects[projectIndex] = {
      ...this.projects[projectIndex],
      ...updates,
      updatedAt: new Date()
    };
    return this.projects[projectIndex];
  }

  // Circuits
  async getCircuits(projectId?: string, searchQuery?: string): Promise<Circuit[]> {
    let filteredCircuits = [...this.circuits];
    
    if (projectId) {
      filteredCircuits = filteredCircuits.filter(c => c.projectId === projectId);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredCircuits = filteredCircuits.filter(c =>
        c.circuitId.toLowerCase().includes(query) ||
        c.carrier.toLowerCase().includes(query) ||
        c.siteName.toLowerCase().includes(query) ||
        c.serviceType.toLowerCase().includes(query)
      );
    }
    
    return filteredCircuits.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCircuit(id: string): Promise<Circuit | undefined> {
    return this.circuits.find(c => c.id === id);
  }

  async createCircuit(circuit: InsertCircuit): Promise<Circuit> {
    const newCircuit: Circuit = {
      id: `circuit-${Date.now()}`,
      ...circuit,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.circuits.push(newCircuit);
    return newCircuit;
  }

  async updateCircuit(id: string, updates: Partial<InsertCircuit>): Promise<Circuit> {
    const circuitIndex = this.circuits.findIndex(c => c.id === id);
    if (circuitIndex === -1) {
      throw new Error('Circuit not found');
    }
    
    this.circuits[circuitIndex] = {
      ...this.circuits[circuitIndex],
      ...updates,
      updatedAt: new Date()
    };
    return this.circuits[circuitIndex];
  }

  async deleteCircuit(id: string): Promise<void> {
    const index = this.circuits.findIndex(c => c.id === id);
    if (index !== -1) {
      this.circuits.splice(index, 1);
    }
  }

  async bulkUpdateCircuits(ids: string[], updates: Partial<InsertCircuit>): Promise<Circuit[]> {
    const updatedCircuits: Circuit[] = [];
    for (const id of ids) {
      const circuitIndex = this.circuits.findIndex(c => c.id === id);
      if (circuitIndex !== -1) {
        this.circuits[circuitIndex] = {
          ...this.circuits[circuitIndex],
          ...updates,
          updatedAt: new Date()
        };
        updatedCircuits.push(this.circuits[circuitIndex]);
      }
    }
    return updatedCircuits;
  }

  // Audit Flags
  async getAuditFlags(circuitId?: string): Promise<AuditFlag[]> {
    let filteredFlags = [...this.auditFlags];
    if (circuitId) {
      filteredFlags = filteredFlags.filter(f => f.circuitId === circuitId);
    }
    return filteredFlags.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createAuditFlag(flag: InsertAuditFlag): Promise<AuditFlag> {
    const newFlag: AuditFlag = {
      id: `flag-${Date.now()}`,
      ...flag,
      isResolved: false,
      createdAt: new Date(),
      resolvedAt: null
    };
    this.auditFlags.push(newFlag);
    return newFlag;
  }

  async updateAuditFlag(id: string, updates: Partial<InsertAuditFlag>): Promise<AuditFlag> {
    const flagIndex = this.auditFlags.findIndex(f => f.id === id);
    if (flagIndex === -1) {
      throw new Error('Audit flag not found');
    }
    
    this.auditFlags[flagIndex] = {
      ...this.auditFlags[flagIndex],
      ...updates
    };
    return this.auditFlags[flagIndex];
  }

  async deleteAuditFlag(id: string): Promise<void> {
    const index = this.auditFlags.findIndex(f => f.id === id);
    if (index !== -1) {
      this.auditFlags.splice(index, 1);
    }
  }

  // Analytics
  async getProjectMetrics(projectId: string): Promise<{
    totalCost: number;
    circuitCount: number;
    highCostCircuits: number;
    opportunities: number;
    avgCostPerMbps: number;
  }> {
    const projectCircuits = this.circuits.filter(c => c.projectId === projectId);
    
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

// Use MemStorage temporarily until database is fixed
export const storage = new MemStorage();
