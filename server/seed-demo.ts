 import 'dotenv/config';
import { db } from './db';
import { users, projects, sites } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

async function ensureUser(id: string, username: string, name: string) {
  const existing = await db.select().from(users).where(eq(users.id, id));
  if (existing.length === 0) {
    await db.insert(users).values({ id, username, password: 'password123', name, role: 'consultant' });
  }
}

async function upsertProject() {
  const projectId = 'demo-project-1';
  const existing = await db.select().from(projects).where(eq(projects.id, projectId));
  if (existing.length === 0) {
    await db.insert(projects).values({
      id: projectId,
      name: 'Demo Project',
      clientName: 'Demo Client',
      status: 'active',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return projectId;
}

const siteData: Array<Omit<typeof sites.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'NYC Corporate HQ', location: 'New York, NY', category: 'Corporate', description: 'Headquarters',
    streetAddress: '350 5TH AVE', city: 'New York', state: 'NY', postalCode: '10118', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'Chicago Branch', location: 'Chicago, IL', category: 'Branch', description: 'Midwest regional office',
    streetAddress: '233 S WACKER DR', city: 'Chicago', state: 'IL', postalCode: '60606', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'Dallas Branch', location: 'Dallas, TX', category: 'Branch', description: 'South central office',
    streetAddress: '400 N SAINT PAUL ST', city: 'Dallas', state: 'TX', postalCode: '75201', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'Los Angeles Branch', location: 'Los Angeles, CA', category: 'Branch', description: 'West region office',
    streetAddress: '600 W 7TH ST', city: 'Los Angeles', state: 'CA', postalCode: '90017', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'San Jose Data Center', location: 'San Jose, CA', category: 'Data Center', description: 'Primary West Coast DC',
    streetAddress: '1 ALMADEN BLVD', city: 'San Jose', state: 'CA', postalCode: '95113', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'Miami Branch', location: 'Miami, FL', category: 'Branch', description: 'Southeast office',
    streetAddress: '200 S BISCAYNE BLVD', city: 'Miami', state: 'FL', postalCode: '33131', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'Houston Branch', location: 'Houston, TX', category: 'Branch', description: 'Gulf region office',
    streetAddress: '1001 FANNIN ST', city: 'Houston', state: 'TX', postalCode: '77002', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'Reston Hub', location: 'Reston, VA', category: 'Corporate', description: 'East coast hub',
    streetAddress: '12100 SUNSET HILLS RD', city: 'Reston', state: 'VA', postalCode: '20190', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'Denver Branch', location: 'Denver, CO', category: 'Branch', description: 'Mountain region office',
    streetAddress: '1700 LINCOLN ST', city: 'Denver', state: 'CO', postalCode: '80203', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  },
  {
    name: 'Seattle Branch', location: 'Seattle, WA', category: 'Branch', description: 'Pacific Northwest office',
    streetAddress: '600 PINE ST', city: 'Seattle', state: 'WA', postalCode: '98101', country: 'United States',
    coordinates: null, nearestMegaportPop: null, megaportDistance: null, megaportRegion: null, projectId: ''
  }
];

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set to run seeding');
  }
  console.log('Seeding demo data...');
  // Ensure baseline users
  await ensureUser('user-1', 'matthew', 'Matthew');
  await ensureUser('user-2', 'tim', 'Tim');

  const projectId = await upsertProject();

  // Remove existing demo sites to keep idempotent
  const existingSites = await db.select().from(sites).where(eq(sites.projectId, projectId));
  if (existingSites.length > 0) {
    // Drizzle doesn't support delete returning rowCount in neon-serverless client; just delete
    await db.delete(sites).where(eq(sites.projectId, projectId));
  }

  const rows = siteData.map((s) => ({
    ...s,
    id: crypto.randomUUID(),
    projectId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await db.insert(sites).values(rows);
  console.log('Seed complete. Project ID:', projectId, 'Sites inserted:', rows.length);
}

seed().then(() => process.exit(0)).catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
