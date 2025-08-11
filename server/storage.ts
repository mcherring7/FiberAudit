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

  private circuits: Circuit[] = [];

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
    // Add circuits for each site (MPLS + Internet per site)
    this.circuits = [
      // New York HQ circuits
      {
        id: "circuit-nyc-int",
        circuitId: "NYC-INT-001",
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
        monthlyCost: "1200.00",
        costPerMbps: "1.20",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-12-31"),
        status: "active",
        optimizationStatus: "pending",
        notes: "Primary internet connection for headquarters",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-15")
      },
      {
        id: "circuit-nyc-mpls",
        circuitId: "NYC-MPLS-001",
        projectId: "project-1",
        siteName: "Corporate HQ - New York",
        carrier: "AT&T",
        locationType: "Corporate",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "500Mbps",
        bandwidthMbps: 500,
        monthlyCost: "3500.00",
        costPerMbps: "7.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-12-31"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS backbone connection",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2024-01-15")
      },
      // San Francisco Data Center circuits
      {
        id: "circuit-sfo-int",
        circuitId: "SFO-INT-001",
        projectId: "project-1",
        siteName: "West Coast Data Center - San Francisco",
        carrier: "Comcast Business",
        locationType: "Data Center",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "10Gbps",
        bandwidthMbps: 10000,
        monthlyCost: "8000.00",
        costPerMbps: "0.80",
        contractTerm: "36 months",
        contractEndDate: new Date("2026-02-28"),
        status: "active",
        optimizationStatus: "pending",
        notes: "High-capacity internet for data center",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-03-01"),
        updatedAt: new Date("2024-01-16")
      },
      {
        id: "circuit-sfo-mpls",
        circuitId: "SFO-MPLS-001",
        projectId: "project-1",
        siteName: "West Coast Data Center - San Francisco",
        carrier: "AT&T",
        locationType: "Data Center",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "1Gbps",
        bandwidthMbps: 1000,
        monthlyCost: "6500.00",
        costPerMbps: "6.50",
        contractTerm: "36 months",
        contractEndDate: new Date("2026-02-28"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection for data center",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-03-01"),
        updatedAt: new Date("2024-01-16")
      },
      // Chicago circuits
      {
        id: "circuit-chi-int",
        circuitId: "CHI-INT-001",
        projectId: "project-1",
        siteName: "Regional Office - Chicago",
        carrier: "Comcast Business",
        locationType: "Branch",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "500Mbps",
        bandwidthMbps: 500,
        monthlyCost: "450.00",
        costPerMbps: "0.90",
        contractTerm: "24 months",
        contractEndDate: new Date("2025-06-30"),
        status: "active",
        optimizationStatus: "pending",
        notes: "Regional office internet",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-06-01"),
        updatedAt: new Date("2024-01-17")
      },
      {
        id: "circuit-chi-mpls",
        circuitId: "CHI-MPLS-001",
        projectId: "project-1",
        siteName: "Regional Office - Chicago",
        carrier: "AT&T",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "200Mbps",
        bandwidthMbps: 200,
        monthlyCost: "1600.00",
        costPerMbps: "8.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-06-30"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection to corporate network",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-06-01"),
        updatedAt: new Date("2024-01-17")
      },
      // Los Angeles circuits
      {
        id: "circuit-lax-int",
        circuitId: "LAX-INT-001",
        projectId: "project-1",
        siteName: "Branch Office - Los Angeles",
        carrier: "Spectrum Business",
        locationType: "Branch",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "500Mbps",
        bandwidthMbps: 500,
        monthlyCost: "400.00",
        costPerMbps: "0.80",
        contractTerm: "24 months",
        contractEndDate: new Date("2025-08-31"),
        status: "active",
        optimizationStatus: "pending",
        notes: "Branch office internet connection",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-09-01"),
        updatedAt: new Date("2024-01-18")
      },
      {
        id: "circuit-lax-mpls",
        circuitId: "LAX-MPLS-001", 
        projectId: "project-1",
        siteName: "Branch Office - Los Angeles",
        carrier: "Verizon",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "200Mbps",
        bandwidthMbps: 200,
        monthlyCost: "1400.00",
        costPerMbps: "7.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-08-31"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection to corporate network",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-09-01"),
        updatedAt: new Date("2024-01-18")
      },
      // Atlanta circuits
      {
        id: "circuit-atl-int",
        circuitId: "ATL-INT-001",
        projectId: "project-1",
        siteName: "Branch Office - Atlanta",
        carrier: "Comcast Business",
        locationType: "Branch",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "300Mbps",
        bandwidthMbps: 300,
        monthlyCost: "320.00",
        costPerMbps: "1.07",
        contractTerm: "24 months",
        contractEndDate: new Date("2025-10-31"),
        status: "active",
        optimizationStatus: "pending",
        notes: "Southeast regional office internet",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-11-01"),
        updatedAt: new Date("2024-01-19")
      },
      {
        id: "circuit-atl-mpls",
        circuitId: "ATL-MPLS-001",
        projectId: "project-1",
        siteName: "Branch Office - Atlanta",
        carrier: "AT&T",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "150Mbps",
        bandwidthMbps: 150,
        monthlyCost: "1200.00",
        costPerMbps: "8.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-10-31"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection for regional hub",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-11-01"),
        updatedAt: new Date("2024-01-19")
      },
      // Seattle circuits
      {
        id: "circuit-sea-int",
        circuitId: "SEA-INT-001",
        projectId: "project-1",
        siteName: "Branch Office - Seattle",
        carrier: "CenturyLink",
        locationType: "Branch",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "400Mbps",
        bandwidthMbps: 400,
        monthlyCost: "380.00",
        costPerMbps: "0.95",
        contractTerm: "24 months",
        contractEndDate: new Date("2025-09-30"),
        status: "active",
        optimizationStatus: "pending",
        notes: "Pacific Northwest operations internet",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-10-01"),
        updatedAt: new Date("2024-01-20")
      },
      {
        id: "circuit-sea-mpls",
        circuitId: "SEA-MPLS-001",
        projectId: "project-1",
        siteName: "Branch Office - Seattle",
        carrier: "Verizon",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "200Mbps",
        bandwidthMbps: 200,
        monthlyCost: "1600.00",
        costPerMbps: "8.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-09-30"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection for Seattle operations",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-10-01"),
        updatedAt: new Date("2024-01-20")
      },
      // Dallas circuits  
      {
        id: "circuit-dfw-int",
        circuitId: "DFW-INT-001",
        projectId: "project-1",
        siteName: "Branch Office - Dallas",
        carrier: "Spectrum Business",
        locationType: "Branch",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "500Mbps",
        bandwidthMbps: 500,
        monthlyCost: "450.00",
        costPerMbps: "0.90",
        contractTerm: "24 months",
        contractEndDate: new Date("2025-11-30"),
        status: "active",
        optimizationStatus: "pending",
        notes: "Southwest regional hub internet",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-12-01"),
        updatedAt: new Date("2024-01-21")
      },
      {
        id: "circuit-dfw-mpls",
        circuitId: "DFW-MPLS-001",
        projectId: "project-1",
        siteName: "Branch Office - Dallas",
        carrier: "AT&T",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "300Mbps",
        bandwidthMbps: 300,
        monthlyCost: "2100.00",
        costPerMbps: "7.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-11-30"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection for regional hub",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-12-01"),
        updatedAt: new Date("2024-01-21")
      },
      // Add remaining circuits for other 13 sites (Boston, Miami, Denver, Phoenix, Minneapolis, Portland, Philadelphia, Nashville, Salt Lake City, Kansas City, Charlotte, San Diego, Las Vegas)
      // Boston circuits
      {
        id: "circuit-bos-int",
        circuitId: "BOS-INT-001",
        projectId: "project-1",
        siteName: "Branch Office - Boston",
        carrier: "Verizon Business",
        locationType: "Branch",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "400Mbps",
        bandwidthMbps: 400,
        monthlyCost: "420.00",
        costPerMbps: "1.05",
        contractTerm: "24 months",
        contractEndDate: new Date("2025-07-31"),
        status: "active",
        optimizationStatus: "pending",
        notes: "Northeast regional office internet",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-08-01"),
        updatedAt: new Date("2024-01-22")
      },
      {
        id: "circuit-bos-mpls",
        circuitId: "BOS-MPLS-001",
        projectId: "project-1",
        siteName: "Branch Office - Boston",
        carrier: "Verizon",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "200Mbps",
        bandwidthMbps: 200,
        monthlyCost: "1400.00",
        costPerMbps: "7.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-07-31"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection for Boston office",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-08-01"),
        updatedAt: new Date("2024-01-22")
      },
      // Miami circuits
      {
        id: "circuit-mia-int",
        circuitId: "MIA-INT-001",
        projectId: "project-1",
        siteName: "Branch Office - Miami",
        carrier: "Comcast Business",
        locationType: "Branch",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "300Mbps",
        bandwidthMbps: 300,
        monthlyCost: "350.00",
        costPerMbps: "1.17",
        contractTerm: "24 months",
        contractEndDate: new Date("2025-09-30"),
        status: "active",
        optimizationStatus: "pending",
        notes: "South Florida operations internet",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-10-01"),
        updatedAt: new Date("2024-01-23")
      },
      {
        id: "circuit-mia-mpls",
        circuitId: "MIA-MPLS-001",
        projectId: "project-1",
        siteName: "Branch Office - Miami",
        carrier: "AT&T",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "150Mbps",
        bandwidthMbps: 150,
        monthlyCost: "1200.00",
        costPerMbps: "8.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-09-30"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection for Miami operations",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2023-10-01"),
        updatedAt: new Date("2024-01-23")
      },
      // Denver circuits
      {
        id: "circuit-den-int",
        circuitId: "DEN-INT-001",
        projectId: "project-1",
        siteName: "Branch Office - Denver",
        carrier: "CenturyLink",
        locationType: "Branch",
        serviceType: "Internet",
        circuitCategory: "Internet",
        aLocation: null,
        zLocation: null,
        bandwidth: "400Mbps",
        bandwidthMbps: 400,
        monthlyCost: "380.00",
        costPerMbps: "0.95",
        contractTerm: "24 months",
        contractEndDate: new Date("2025-12-31"),
        status: "active",
        optimizationStatus: "pending",
        notes: "Mountain West operations internet",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-24")
      },
      {
        id: "circuit-den-mpls",
        circuitId: "DEN-MPLS-001",
        projectId: "project-1",
        siteName: "Branch Office - Denver",
        carrier: "Verizon",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        aLocation: null,
        zLocation: null,
        bandwidth: "200Mbps",
        bandwidthMbps: 200,
        monthlyCost: "1600.00",
        costPerMbps: "8.00",
        contractTerm: "36 months",
        contractEndDate: new Date("2025-12-31"),
        status: "active",
        optimizationStatus: "opportunity",
        notes: "MPLS connection for Mountain West",
        flags: [],
        siteFeatures: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-24")
      }
    ];

    // Add 20 geographically dispersed US sites
    this.sites = [
      {
        id: "site-1",
        name: "Corporate HQ - New York",
        location: "Manhattan, NY",
        category: "Corporate",
        description: "Global headquarters and executive offices",
        projectId: "project-1",
        streetAddress: "1345 Avenue of the Americas",
        city: "New York",
        state: "NY",
        postalCode: "10105",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 40.7589,
        longitude: -73.9851,
        nearestMegaportPop: "NYC1 - New York",
        megaportDistance: 2.1,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
      },
      {
        id: "site-2",
        name: "West Coast Data Center - San Francisco",
        location: "SOMA District, CA",
        category: "Data Center",
        description: "Primary west coast data center facility",
        projectId: "project-1",
        streetAddress: "601 Townsend Street",
        city: "San Francisco",
        state: "CA",
        postalCode: "94103",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 37.7699,
        longitude: -122.4037,
        nearestMegaportPop: "SJC1 - San Jose",
        megaportDistance: 42.8,
        createdAt: new Date("2024-01-02"),
        updatedAt: new Date("2024-01-16"),
      },
      {
        id: "site-3",
        name: "Regional Office - Chicago",
        location: "The Loop, IL",
        category: "Branch",
        description: "Midwest regional headquarters",
        projectId: "project-1",
        streetAddress: "233 South Wacker Drive",
        city: "Chicago",
        state: "IL",
        postalCode: "60606",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 41.8794,
        longitude: -87.6358,
        nearestMegaportPop: "CHI1 - Chicago",
        megaportDistance: 5.4,
        createdAt: new Date("2024-01-03"),
        updatedAt: new Date("2024-01-17"),
      },
      {
        id: "site-4",
        name: "Branch Office - Los Angeles",
        location: "Downtown LA, CA",
        category: "Branch", 
        description: "Southern California operations center",
        projectId: "project-1",
        streetAddress: "515 South Flower Street",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90071",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 34.0522,
        longitude: -118.2570,
        nearestMegaportPop: "LAX1 - Los Angeles",
        megaportDistance: 18.3,
        createdAt: new Date("2024-01-04"),
        updatedAt: new Date("2024-01-18"),
      },
      {
        id: "site-5",
        name: "Branch Office - Atlanta",
        location: "Midtown, GA",
        category: "Branch",
        description: "Southeast regional office",
        projectId: "project-1",
        streetAddress: "1180 Peachtree Street NE",
        city: "Atlanta",
        state: "GA",
        postalCode: "30309",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 33.7860,
        longitude: -84.3837,
        nearestMegaportPop: "ATL1 - Atlanta",
        megaportDistance: 8.7,
        createdAt: new Date("2024-01-05"),
        updatedAt: new Date("2024-01-19"),
      },
      {
        id: "site-6",
        name: "Branch Office - Seattle",
        location: "Belltown, WA",
        category: "Branch",
        description: "Pacific Northwest operations",
        projectId: "project-1",
        streetAddress: "2001 8th Avenue",
        city: "Seattle",
        state: "WA",
        postalCode: "98121",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 47.6143,
        longitude: -122.3438,
        nearestMegaportPop: "SEA1 - Seattle",
        megaportDistance: 12.1,
        createdAt: new Date("2024-01-06"),
        updatedAt: new Date("2024-01-20"),
      },
      {
        id: "site-7",
        name: "Branch Office - Dallas",
        location: "Uptown, TX",
        category: "Branch",
        description: "Southwest regional hub",
        projectId: "project-1",
        streetAddress: "2900 McKinney Avenue",
        city: "Dallas",
        state: "TX",
        postalCode: "75204",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 32.7937,
        longitude: -96.7854,
        nearestMegaportPop: "DFW1 - Dallas",
        megaportDistance: 3.2,
        createdAt: new Date("2024-01-07"),
        updatedAt: new Date("2024-01-21"),
      },
      {
        id: "site-8",
        name: "Branch Office - Boston",
        location: "Financial District, MA",
        category: "Branch",
        description: "Northeast regional office",
        projectId: "project-1",
        streetAddress: "101 Federal Street",
        city: "Boston",
        state: "MA",
        postalCode: "02110",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 42.3554,
        longitude: -71.0562,
        nearestMegaportPop: "BOS1 - Boston",
        megaportDistance: 4.8,
        createdAt: new Date("2024-01-08"),
        updatedAt: new Date("2024-01-22"),
      },
      {
        id: "site-9",
        name: "Branch Office - Miami",
        location: "Brickell, FL",
        category: "Branch",
        description: "South Florida operations",
        projectId: "project-1",
        streetAddress: "1395 Brickell Avenue",
        city: "Miami",
        state: "FL",
        postalCode: "33131",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 25.7617,
        longitude: -80.1918,
        nearestMegaportPop: "MIA1 - Miami",
        megaportDistance: 6.3,
        createdAt: new Date("2024-01-09"),
        updatedAt: new Date("2024-01-23"),
      },
      {
        id: "site-10",
        name: "Branch Office - Denver",
        location: "Downtown, CO",
        category: "Branch",
        description: "Mountain West operations",
        projectId: "project-1",
        streetAddress: "1700 Lincoln Street",
        city: "Denver",
        state: "CO",
        postalCode: "80203",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 39.7444,
        longitude: -104.9876,
        nearestMegaportPop: "DEN1 - Denver",
        megaportDistance: 7.2,
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-01-24"),
      },
      {
        id: "site-11",
        name: "Branch Office - Phoenix",
        location: "Midtown, AZ",
        category: "Branch",
        description: "Southwest desert operations",
        projectId: "project-1",
        streetAddress: "2901 North Central Avenue",
        city: "Phoenix",
        state: "AZ",
        postalCode: "85012",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 33.4734,
        longitude: -112.0740,
        nearestMegaportPop: "PHX1 - Phoenix",
        megaportDistance: 9.1,
        createdAt: new Date("2024-01-11"),
        updatedAt: new Date("2024-01-25"),
      },
      {
        id: "site-12",
        name: "Branch Office - Minneapolis",
        location: "Downtown, MN",
        category: "Branch",
        description: "Upper Midwest operations",
        projectId: "project-1",
        streetAddress: "80 South 8th Street",
        city: "Minneapolis",
        state: "MN",
        postalCode: "55402",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 44.9778,
        longitude: -93.2650,
        nearestMegaportPop: "MSP1 - Minneapolis",
        megaportDistance: 11.7,
        createdAt: new Date("2024-01-12"),
        updatedAt: new Date("2024-01-26"),
      },
      {
        id: "site-13",
        name: "Branch Office - Portland",
        location: "Pearl District, OR",
        category: "Branch",
        description: "Oregon operations center",
        projectId: "project-1",
        streetAddress: "1000 NW Glisan Street",
        city: "Portland",
        state: "OR",
        postalCode: "97209",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 45.5266,
        longitude: -122.6806,
        nearestMegaportPop: "PDX1 - Portland",
        megaportDistance: 14.6,
        createdAt: new Date("2024-01-13"),
        updatedAt: new Date("2024-01-27"),
      },
      {
        id: "site-14",
        name: "Branch Office - Philadelphia",
        location: "Center City, PA",
        category: "Branch",
        description: "Mid-Atlantic regional office",
        projectId: "project-1",
        streetAddress: "1650 Market Street",
        city: "Philadelphia",
        state: "PA",
        postalCode: "19103",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 39.9526,
        longitude: -75.1652,
        nearestMegaportPop: "PHL1 - Philadelphia",
        megaportDistance: 5.9,
        createdAt: new Date("2024-01-14"),
        updatedAt: new Date("2024-01-28"),
      },
      {
        id: "site-15",
        name: "Branch Office - Nashville",
        location: "Music Row, TN",
        category: "Branch",
        description: "Tennessee operations center",
        projectId: "project-1",
        streetAddress: "1801 West End Avenue",
        city: "Nashville",
        state: "TN",
        postalCode: "37203",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 36.1547,
        longitude: -86.8015,
        nearestMegaportPop: "NSH1 - Nashville",
        megaportDistance: 8.3,
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-29"),
      },
      {
        id: "site-16",
        name: "Branch Office - Salt Lake City",
        location: "Downtown, UT",
        category: "Branch",
        description: "Intermountain West operations",
        projectId: "project-1",
        streetAddress: "15 West Temple Street",
        city: "Salt Lake City",
        state: "UT",
        postalCode: "84101",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 40.7714,
        longitude: -111.8910,
        nearestMegaportPop: "SLC1 - Salt Lake City",
        megaportDistance: 6.7,
        createdAt: new Date("2024-01-16"),
        updatedAt: new Date("2024-01-30"),
      },
      {
        id: "site-17",
        name: "Branch Office - Kansas City",
        location: "Downtown, MO",
        category: "Branch",
        description: "Central Plains operations",
        projectId: "project-1",
        streetAddress: "1200 Main Street",
        city: "Kansas City",
        state: "MO",
        postalCode: "64105",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 39.0997,
        longitude: -94.5786,
        nearestMegaportPop: "KC1 - Kansas City",
        megaportDistance: 4.2,
        createdAt: new Date("2024-01-17"),
        updatedAt: new Date("2024-01-31"),
      },
      {
        id: "site-18",
        name: "Branch Office - Charlotte",
        location: "Uptown, NC",
        category: "Branch",
        description: "Carolinas regional office",
        projectId: "project-1",
        streetAddress: "214 North Tryon Street",
        city: "Charlotte",
        state: "NC",
        postalCode: "28202",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 35.2271,
        longitude: -80.8431,
        nearestMegaportPop: "CLT1 - Charlotte",
        megaportDistance: 7.8,
        createdAt: new Date("2024-01-18"),
        updatedAt: new Date("2024-02-01"),
      },
      {
        id: "site-19",
        name: "Branch Office - San Diego",
        location: "Downtown, CA",
        category: "Branch",
        description: "Southern California satellite office",
        projectId: "project-1",
        streetAddress: "600 B Street",
        city: "San Diego",
        state: "CA",
        postalCode: "92101",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 32.7157,
        longitude: -117.1611,
        nearestMegaportPop: "SD1 - San Diego",
        megaportDistance: 3.9,
        createdAt: new Date("2024-01-19"),
        updatedAt: new Date("2024-02-02"),
      },
      {
        id: "site-20",
        name: "Branch Office - Las Vegas",
        location: "Downtown, NV",
        category: "Branch",
        description: "Nevada operations center",
        projectId: "project-1",
        streetAddress: "1 Main Street",
        city: "Las Vegas",
        state: "NV",
        postalCode: "89101",
        country: "United States",
        addressValidated: true,
        validationProvider: "google",
        latitude: 36.1699,
        longitude: -115.1398,
        nearestMegaportPop: "LAS1 - Las Vegas",
        megaportDistance: 5.1,
        createdAt: new Date("2024-01-20"),
        updatedAt: new Date("2024-02-03"),
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