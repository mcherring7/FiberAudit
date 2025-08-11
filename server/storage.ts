import { users, projects, circuits, auditFlags, sites, type User, type Project, type Circuit, type AuditFlag, type Site, type InsertSite } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

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

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: User[] = [
    {
      id: "user-1",
      name: "John Smith",
      username: "john.smith",
      password: "hashedpassword123",
      role: "consultant",
      createdAt: new Date("2024-01-01"),
    },
    {
      id: "user-2", 
      name: "Sarah Johnson",
      username: "sarah.johnson",
      password: "hashedpassword456",
      role: "admin",
      createdAt: new Date("2024-01-01"),
    }
  ];

  private projects: Project[] = [
    {
      id: "project-1",
      name: "Global Network Audit 2024",
      createdAt: new Date("2024-01-01"),
      status: "active",
      clientName: "TechCorp International", 
      createdBy: "user-1",
      updatedAt: new Date("2024-01-15"),
    },
    {
      id: "project-2",
      name: "MPLS Optimization Study", 
      createdAt: new Date("2024-01-05"),
      status: "planning",
      clientName: "Manufacturing Solutions Inc",
      createdBy: "user-2",
      updatedAt: new Date("2024-01-20"),
    }
  ];

  private circuits: Circuit[] = [
    {
      id: "circuit-1",
      circuitId: "CKT-NYC-001",
      projectId: "project-1", 
      siteName: "Corporate HQ - New York",
      carrier: "Verizon",
      locationType: "Corporate",
      serviceType: "Internet",
      circuitCategory: "Internet",
      aLocation: null,
      zLocation: null,
      bandwidth: "1Gbps",
      bandwidthMbps: 1000,
      monthlyCost: "1500.00",
      costPerMbps: "1.50",
      contractTerm: "36 months",
      contractEndDate: new Date("2025-12-31"),
      status: "active",
      optimizationStatus: "pending",
      notes: "Primary internet connection for headquarters",
      flags: [],
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2024-01-15")
    },
    {
      id: "circuit-2",
      circuitId: "CKT-CHI-MPLS-001",
      projectId: "project-1",
      siteName: "Branch Office - Chicago",
      carrier: "AT&T",
      locationType: "Branch", 
      serviceType: "MPLS",
      bandwidth: "100Mbps",
      bandwidthMbps: 100,
      monthlyCost: "800.00",
      costPerMbps: "8.00",
      contractTerm: "36 months", 
      contractEndDate: new Date("2025-05-31"),
      status: "active",
      optimizationStatus: "opportunity", 
      notes: "MPLS connection to corporate network",
      flags: [],
      createdAt: new Date("2022-06-01"),
      updatedAt: new Date("2024-01-10")
    },
    {
      id: "circuit-3",
      circuitId: "CKT-LA-P2P-001",
      projectId: "project-2",
      siteName: "Data Center - Los Angeles",
      carrier: "CenturyLink",
      locationType: "Data Center",
      serviceType: "Point-to-Point",
      bandwidth: "10Gbps",
      bandwidthMbps: 10000,
      monthlyCost: "4500.00",
      costPerMbps: "0.45",
      contractTerm: "36 months",
      contractEndDate: new Date("2026-02-28"),
      status: "active",
      optimizationStatus: "pending",
      notes: "Dedicated line to backup data center", 
      flags: [],
      createdAt: new Date("2023-03-01"),
      updatedAt: new Date("2024-01-20")
    },
    {
      id: "circuit-4",
      circuitId: "AWS-DX-001",
      projectId: "project-1",
      siteName: "Cloud - AWS US-East-1",
      carrier: "AWS",
      locationType: "Cloud",
      serviceType: "AWS Direct Connect",
      bandwidth: "1Gbps", 
      bandwidthMbps: 1000,
      monthlyCost: "300.00",
      costPerMbps: "0.30",
      contractTerm: "12 months",
      contractEndDate: new Date("2024-07-31"),
      status: "active",
      optimizationStatus: "pending",
      notes: "Direct connection to AWS VPC",
      flags: [],
      createdAt: new Date("2023-08-01"),
      updatedAt: new Date("2024-01-25")
    },
    {
      id: "circuit-5",
      circuitId: "CKT-SF-INT-001",
      projectId: "project-2",
      siteName: "Branch Office - San Francisco",
      carrier: "Comcast",
      locationType: "Branch",
      serviceType: "Internet",
      bandwidth: "500Mbps",
      bandwidthMbps: 500,
      monthlyCost: "400.00",
      costPerMbps: "0.80",
      contractTerm: "24 months",
      contractEndDate: new Date("2025-08-31"),
      status: "active",
      optimizationStatus: "pending",
      notes: "High-speed internet for west coast office",
      flags: [],
      createdAt: new Date("2023-09-01"),
      updatedAt: new Date("2024-01-12")
    },
    {
      id: "circuit-6",
      circuitId: "CKT-VPLS-001",
      projectId: "project-1",
      siteName: "Branch Network - Miami",
      carrier: "Verizon",
      locationType: "Branch",
      serviceType: "VPLS",
      bandwidth: "200Mbps",
      bandwidthMbps: 200,
      monthlyCost: "1200.00",
      costPerMbps: "6.00",
      contractTerm: "36 months",
      contractEndDate: new Date("2025-11-30"),
      status: "active",
      optimizationStatus: "pending",
      notes: "VPLS multipoint connection for branch locations", 
      flags: [],
      createdAt: new Date("2022-12-01"),
      updatedAt: new Date("2024-01-18")
    },
    {
      id: "circuit-7",
      circuitId: "CKT-SDWAN-001",
      projectId: "project-2",
      siteName: "SD-WAN Hub - Dallas",
      carrier: "Cisco Meraki",
      locationType: "Corporate",
      serviceType: "SD-WAN",
      bandwidth: "1Gbps",
      bandwidthMbps: 1000,
      monthlyCost: "800.00",
      costPerMbps: "0.80",
      contractTerm: "48 months",
      contractEndDate: new Date("2027-12-31"),
      status: "active",
      optimizationStatus: "pending", 
      notes: "SD-WAN overlay for hybrid WAN architecture",
      flags: [],
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-30")
    },
    {
      id: "circuit-8",
      circuitId: "MEGAPORT-001",
      projectId: "project-1",
      siteName: "Global Backbone - Virginia",
      carrier: "Megaport",
      locationType: "Data Center",
      serviceType: "NaaS",
      bandwidth: "10Gbps",
      bandwidthMbps: 10000,
      monthlyCost: "2500.00",
      costPerMbps: "0.25", 
      contractTerm: "36 months",
      contractEndDate: new Date("2026-05-31"),
      status: "active", 
      optimizationStatus: "pending",
      notes: "Megaport NaaS backbone replacing traditional MPLS",
      flags: [],
      createdAt: new Date("2023-06-01"),
      updatedAt: new Date("2024-01-28")
    }
  ];

  private auditFlags: AuditFlag[] = [
    {
      id: "flag-1",
      createdAt: new Date("2024-01-10"),
      createdBy: "user-1",
      circuitId: "circuit-2", 
      flagType: "cost-optimization",
      severity: "medium",
      title: "High cost per Mbps for MPLS circuit",
      description: "This MPLS circuit has a cost per Mbps of $8.00, which is significantly higher than industry benchmarks for similar bandwidth.",
      isResolved: false,
      resolvedAt: null,
    },
    {
      id: "flag-2",
      createdAt: new Date("2024-01-15"),
      createdBy: "user-1",
      circuitId: "circuit-1",
      flagType: "contract-renewal",
      severity: "low", 
      title: "Contract expiring within 12 months",
      description: "This circuit contract is set to expire on 2025-12-31. Consider negotiating renewal terms or exploring alternatives.",
      isResolved: false,
      resolvedAt: null,
    }
  ];

  constructor() {
    // Add mock sites for demonstration
    this.sites = [
      {
        id: "site-1",
        name: "Corporate HQ - New York",
        location: "Manhattan, NY", 
        category: "Corporate",
        description: "Primary corporate headquarters with executive offices and data center",
        projectId: "project-1",
        streetAddress: "1 World Trade Center",
        city: "New York",
        state: "NY",
        postalCode: "10007",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 40.7127,
        longitude: -74.0134,
        nearestMegaportPop: "NYC1 - New York",
        megaportDistance: 2.3,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
      },
      {
        id: "site-2",
        name: "Branch Office - Los Angeles", 
        location: "Downtown LA, CA",
        category: "Branch",
        description: "West coast regional office and customer service center",
        projectId: "project-1",
        streetAddress: "633 West 5th Street",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90071",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 34.0522,
        longitude: -118.2437,
        nearestMegaportPop: "LAX1 - Los Angeles",
        megaportDistance: 15.7,
        createdAt: new Date("2024-01-02"),
        updatedAt: new Date("2024-01-16"),
      },
      {
        id: "site-3",
        name: "Data Center - Chicago",
        location: "Chicago, IL",
        category: "Data Center", 
        description: "Primary data center facility with disaster recovery capabilities",
        projectId: "project-2",
        streetAddress: "350 E Cermak Rd",
        city: "Chicago",
        state: "IL",
        postalCode: "60616",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 41.8781,
        longitude: -87.6298,
        nearestMegaportPop: "CHI1 - Chicago", 
        megaportDistance: 8.4,
        createdAt: new Date("2024-01-03"),
        updatedAt: new Date("2024-01-17"),
      },
      {
        id: "site-4",
        name: "Remote Office - Austin",
        location: "Austin, TX",
        category: "Branch",
        description: "Regional development office",
        projectId: "project-1", 
        streetAddress: "301 Congress Ave",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "United States",
        addressValidated: false,
        validationProvider: null,
        latitude: null,
        longitude: null,
        nearestMegaportPop: null,
        megaportDistance: null,
        createdAt: new Date("2024-01-04"),
        updatedAt: new Date("2024-01-18"),
      }
    ];
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      ...userData,
      createdAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.users].sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User | undefined> {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return undefined;

    this.users[index] = { ...this.users[index], ...userData };
    return this.users[index];
  }

  async deleteUser(id: string): Promise<boolean> {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return false;
    
    this.users.splice(index, 1);
    return true;
  }

  // Project methods
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.find(project => project.id === id);
  }

  async getAllProjects(): Promise<Project[]> {
    return [...this.projects].sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const project: Project = {
      id: crypto.randomUUID(),
      ...projectData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.push(project);
    return project;
  }

  async updateProject(id: string, projectData: Partial<Project>): Promise<Project | undefined> {
    const index = this.projects.findIndex(project => project.id === id);
    if (index === -1) return undefined;

    this.projects[index] = { 
      ...this.projects[index], 
      ...projectData, 
      updatedAt: new Date() 
    };
    return this.projects[index];
  }

  async deleteProject(id: string): Promise<boolean> {
    const index = this.projects.findIndex(project => project.id === id);
    if (index === -1) return false;
    
    this.projects.splice(index, 1);
    return true;
  }

  // Circuit methods
  async getCircuit(id: string): Promise<Circuit | undefined> {
    return this.circuits.find(circuit => circuit.id === id);
  }

  async getAllCircuits(): Promise<Circuit[]> {
    return [...this.circuits].sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async getCircuitsByProject(projectId: string): Promise<Circuit[]> {
    return this.circuits.filter(circuit => circuit.projectId === projectId);
  }

  async createCircuit(circuitData: Omit<Circuit, 'id' | 'createdAt' | 'updatedAt'>): Promise<Circuit> {
    // Automatic circuit category assignment based on service type
    const getCircuitCategory = (serviceType: string): string => {
      if (['MPLS', 'VPLS'].includes(serviceType)) {
        return 'Private';
      } else if (['Private Line', 'Wavelength', 'Dark Fiber'].includes(serviceType)) {
        return 'Point-to-Point';
      } else if (['AWS Direct Connect', 'Azure ExpressRoute'].includes(serviceType)) {
        return 'Private Cloud WAN';
      } else {
        // Default for Internet, Broadband, Dedicated Internet, LTE, Satellite, SD-WAN, NaaS
        return 'Internet';
      }
    };

    // Calculate bandwidth in Mbps if not provided
    let bandwidthMbps = circuitData.bandwidthMbps;
    if (!bandwidthMbps && circuitData.bandwidth) {
      const bandwidthMatch = circuitData.bandwidth.match(/(\d+(?:\.\d+)?)/);
      bandwidthMbps = bandwidthMatch ? parseFloat(bandwidthMatch[1]) : 0;
      if (circuitData.bandwidth.toLowerCase().includes('gbps')) {
        bandwidthMbps *= 1000;
      }
    }

    // Calculate cost per Mbps
    let costPerMbps = '0.00';
    if (circuitData.monthlyCost && bandwidthMbps && bandwidthMbps > 0) {
      const monthlyCost = typeof circuitData.monthlyCost === 'string' ? 
        parseFloat(circuitData.monthlyCost) : circuitData.monthlyCost;
      costPerMbps = (monthlyCost / bandwidthMbps).toFixed(2);
    }

    const circuit: Circuit = {
      id: crypto.randomUUID(),
      ...circuitData,
      circuitCategory: circuitData.circuitCategory || getCircuitCategory(circuitData.serviceType),
      bandwidthMbps: bandwidthMbps || 0,
      costPerMbps,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.circuits.push(circuit);
    return circuit;
  }

  async updateCircuit(id: string, circuitData: Partial<Circuit>): Promise<Circuit | undefined> {
    const index = this.circuits.findIndex(circuit => circuit.id === id);
    if (index === -1) return undefined;

    // Auto-assign circuit category based on service type if service type is being updated
    if (circuitData.serviceType) {
      const serviceType = circuitData.serviceType;
      
      // Map service types to circuit categories based on user requirements
      if (['Broadband', 'Dedicated Internet', 'LTE', 'Satellite', 'Internet'].includes(serviceType)) {
        circuitData.circuitCategory = 'Internet';
      } else if (['MPLS', 'VPLS'].includes(serviceType)) {
        circuitData.circuitCategory = 'Private';
      } else if (['Private Line', 'Wavelength', 'Dark Fiber', 'Point-to-Point'].includes(serviceType)) {
        circuitData.circuitCategory = 'Point-to-Point';
      } else if (['AWS Direct Connect', 'Direct Connect'].includes(serviceType)) {
        circuitData.circuitCategory = 'Private Cloud WAN';
      } else if (['Azure ExpressRoute', 'ExpressRoute'].includes(serviceType)) {
        circuitData.circuitCategory = 'Private Cloud WAN';
      } else if (['SD-WAN', 'NaaS'].includes(serviceType)) {
        circuitData.circuitCategory = 'Internet'; // SD-WAN typically uses internet transport
      }
    }
    
    // Ensure monthlyCost is stored as string (current storage format)
    if (circuitData.monthlyCost !== undefined) {
      circuitData.monthlyCost = circuitData.monthlyCost.toString();
    }
    
    // Recalculate cost per Mbps if bandwidth or monthlyCost changed
    const currentCircuit = this.circuits[index];
    let newBandwidthMbps = currentCircuit.bandwidthMbps;
    let newMonthlyCost = parseFloat(currentCircuit.monthlyCost);
    
    if (circuitData.bandwidth) {
      // Extract numeric value from bandwidth string (e.g., "100Mbps" -> 100)
      const bandwidthMatch = circuitData.bandwidth.match(/(\d+(?:\.\d+)?)/);
      newBandwidthMbps = bandwidthMatch ? parseFloat(bandwidthMatch[1]) : 0;
      
      // Handle units (assume Mbps if no unit specified)
      if (circuitData.bandwidth.toLowerCase().includes('gbps')) {
        newBandwidthMbps *= 1000;
      }
      
      circuitData.bandwidthMbps = newBandwidthMbps;
    }
    
    if (circuitData.monthlyCost) {
      newMonthlyCost = parseFloat(circuitData.monthlyCost.toString());
    }
    
    // Calculate cost per Mbps
    if (circuitData.bandwidth || circuitData.monthlyCost) {
      circuitData.costPerMbps = newBandwidthMbps > 0 ? (newMonthlyCost / newBandwidthMbps).toFixed(2) : '0.00';
    }

    this.circuits[index] = { 
      ...this.circuits[index], 
      ...circuitData, 
      updatedAt: new Date() 
    };
    return this.circuits[index];
  }

  async deleteCircuit(id: string): Promise<boolean> {
    const index = this.circuits.findIndex(circuit => circuit.id === id);
    if (index === -1) return false;
    
    this.circuits.splice(index, 1);
    return true;
  }

  // Add bulk update method
  async bulkUpdateCircuits(ids: string[], updates: Partial<Circuit>): Promise<Circuit[]> {
    const updatedCircuits: Circuit[] = [];
    
    for (const id of ids) {
      const updated = await this.updateCircuit(id, updates);
      if (updated) {
        updatedCircuits.push(updated);
      }
    }
    
    return updatedCircuits;
  }

  // Audit flag methods
  async getAuditFlag(id: string): Promise<AuditFlag | undefined> {
    return this.auditFlags.find(flag => flag.id === id);
  }

  async getAllAuditFlags(): Promise<AuditFlag[]> {
    return [...this.auditFlags].sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async getAuditFlagsByCircuit(circuitId: string): Promise<AuditFlag[]> {
    return this.auditFlags.filter(flag => flag.circuitId === circuitId);
  }

  async createAuditFlag(flagData: Omit<AuditFlag, 'id' | 'createdAt'>): Promise<AuditFlag> {
    const flag: AuditFlag = {
      id: crypto.randomUUID(),
      ...flagData,
      createdAt: new Date(),
    };
    this.auditFlags.push(flag);
    return flag;
  }

  async updateAuditFlag(id: string, flagData: Partial<AuditFlag>): Promise<AuditFlag | undefined> {
    const index = this.auditFlags.findIndex(flag => flag.id === id);
    if (index === -1) return undefined;

    this.auditFlags[index] = { ...this.auditFlags[index], ...flagData };
    return this.auditFlags[index];
  }

  async deleteAuditFlag(id: string): Promise<boolean> {
    const index = this.auditFlags.findIndex(flag => flag.id === id);
    if (index === -1) return false;
    
    this.auditFlags.splice(index, 1);
    return true;
  }

  async getAuditFlags(circuitId?: string): Promise<AuditFlag[]> {
    if (circuitId) {
      return this.auditFlags.filter(flag => flag.circuitId === circuitId);
    }
    return [...this.auditFlags];
  }

  async getProjectMetrics(projectId: string): Promise<any> {
    const circuits = await this.getCircuitsByProject(projectId);
    const totalCircuits = circuits.length;
    const totalMonthlyCost = circuits.reduce((sum, circuit) => sum + parseFloat(circuit.monthlyCost), 0);
    const avgCostPerMbps = circuits.length > 0 ? 
      circuits.reduce((sum, circuit) => sum + parseFloat(circuit.costPerMbps), 0) / circuits.length : 0;
    
    // Count by service type
    const serviceTypes = circuits.reduce((acc, circuit) => {
      acc[circuit.serviceType] = (acc[circuit.serviceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Count optimization opportunities
    const optimizationOpportunities = circuits.filter(c => parseFloat(c.costPerMbps) > 10).length;
    
    return {
      totalCircuits,
      totalMonthlyCost,
      avgCostPerMbps: avgCostPerMbps.toFixed(2),
      serviceTypes,
      optimizationOpportunities,
    };
  }

  // Site methods
  private sites: Site[] = [];

  async getSite(id: string): Promise<Site | undefined> {
    return this.sites.find(site => site.id === id);
  }

  async getAllSites(): Promise<Site[]> {
    return [...this.sites].sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async getSitesByProject(projectId: string): Promise<Site[]> {
    return this.sites.filter(site => site.projectId === projectId);
  }

  async createSite(siteData: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>): Promise<Site> {
    const site: Site = {
      id: crypto.randomUUID(),
      ...siteData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sites.push(site);
    return site;
  }

  async updateSite(id: string, siteData: Partial<Site>): Promise<Site | undefined> {
    const index = this.sites.findIndex(site => site.id === id);
    if (index === -1) return undefined;

    this.sites[index] = { 
      ...this.sites[index], 
      ...siteData, 
      updatedAt: new Date() 
    };
    return this.sites[index];
  }

  async deleteSite(id: string): Promise<boolean> {
    const index = this.sites.findIndex(site => site.id === id);
    if (index === -1) return false;
    
    this.sites.splice(index, 1);
    return true;
  }
}

export const storage = new MemStorage();