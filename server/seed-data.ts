import { storage } from "./storage";

export async function seedDevelopmentData() {
  try {
    // Check if we already have data
    const existingProjects = await storage.getAllProjects();
    if (existingProjects.length > 0) {
      console.log('Development data already exists, skipping seed.');
      return;
    }

    // Create a sample project
    const project = await storage.createProject({
      name: "Enterprise Network Optimization",
      clientName: "Technologent Demo",
      status: "active",
      createdBy: null
    });

    // Create sample circuits for the project
    const sampleCircuits = [
      {
        circuitId: "VZ-MPLS-NYC-001",
        projectId: project.id,
        siteName: "New York HQ",
        carrier: "Verizon",
        locationType: "Corporate",
        serviceType: "MPLS",
        circuitCategory: "Private",
        bandwidth: "100 Mbps",
        bandwidthMbps: 100,
        monthlyCost: "4500.00",
        costPerMbps: "45.00",
        aLocation: null,
        zLocation: null,
        contractEndDate: null,
        notes: null,
        flags: [],
        siteFeatures: [],
        contractTerm: "36 months",
        status: "active",
        optimizationStatus: "pending"
      },
      {
        circuitId: "ATT-MPLS-CHI-002",
        projectId: project.id,
        siteName: "Chicago Office",
        carrier: "AT&T",
        locationType: "Branch",
        serviceType: "MPLS",
        circuitCategory: "Private",
        bandwidth: "50 Mbps",
        bandwidthMbps: 50,
        monthlyCost: "2800.00",
        costPerMbps: "56.00",
        aLocation: null,
        zLocation: null,
        contractEndDate: null,
        notes: null,
        flags: [],
        siteFeatures: [],
        contractTerm: "24 months",
        status: "active",
        optimizationStatus: "pending"
      },
      {
        circuitId: "COMCAST-DIA-LAX-003",
        projectId: project.id,
        siteName: "Los Angeles Branch",
        carrier: "Comcast",
        locationType: "Branch",
        serviceType: "DIA",
        circuitCategory: "Internet",
        bandwidth: "200 Mbps",
        bandwidthMbps: 200,
        monthlyCost: "1800.00",
        costPerMbps: "9.00",
        aLocation: null,
        zLocation: null,
        contractEndDate: null,
        notes: null,
        flags: [],
        siteFeatures: [],
        contractTerm: "12 months",
        status: "active",
        optimizationStatus: "optimized"
      },
      {
        circuitId: "SPECTRUM-DIA-MIA-004",
        projectId: project.id,
        siteName: "Miami Office",
        carrier: "Spectrum",
        locationType: "Branch",
        serviceType: "DIA",
        circuitCategory: "Internet",
        bandwidth: "100 Mbps",
        bandwidthMbps: 100,
        monthlyCost: "1200.00",
        costPerMbps: "12.00",
        aLocation: null,
        zLocation: null,
        contractEndDate: null,
        notes: null,
        flags: [],
        siteFeatures: [],
        contractTerm: "24 months",
        status: "active",
        optimizationStatus: "pending"
      }
    ];

    for (const circuitData of sampleCircuits) {
      await storage.createCircuit(circuitData);
    }

    // Create sample sites
    const sampleSites = [
      {
        name: "New York HQ",
        location: "New York, NY",
        category: "Corporate",
        description: "Main corporate headquarters",
        streetAddress: "1 World Trade Center",
        city: "New York",
        state: "NY",
        postalCode: "10007",
        country: "United States",
        latitude: 40.7128,
        longitude: -74.0060,
        addressValidated: true,
        coordinates: null,
        addressValidationResponse: null,
        nearestMegaportPop: null,
        megaportDistance: null,
        megaportRegion: null,
        projectId: project.id
      },
      {
        name: "Chicago Office",
        location: "Chicago, IL",
        category: "Branch",
        description: "Regional branch office",
        streetAddress: "233 S Wacker Dr",
        city: "Chicago",
        state: "IL",
        postalCode: "60606",
        country: "United States",
        latitude: 41.8781,
        longitude: -87.6298,
        addressValidated: true,
        coordinates: null,
        addressValidationResponse: null,
        nearestMegaportPop: null,
        megaportDistance: null,
        megaportRegion: null,
        projectId: project.id
      },
      {
        name: "Los Angeles Branch",
        location: "Los Angeles, CA",
        category: "Branch",
        description: "West coast operations",
        streetAddress: "633 W 5th St",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90071",
        country: "United States",
        latitude: 34.0522,
        longitude: -118.2437,
        addressValidated: true,
        coordinates: null,
        addressValidationResponse: null,
        nearestMegaportPop: null,
        megaportDistance: null,
        megaportRegion: null,
        projectId: project.id
      }
    ];

    for (const siteData of sampleSites) {
      await storage.createSite(siteData);
    }

    console.log('Development seed data created successfully!');
    console.log(`Project ID: ${project.id}`);
    console.log(`Created ${sampleCircuits.length} circuits and ${sampleSites.length} sites`);
    
  } catch (error) {
    console.error('Error seeding development data:', error);
  }
}