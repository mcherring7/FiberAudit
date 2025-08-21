import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default('consultant'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  clientName: text("client_name").notNull(),
  status: text("status").notNull().default('active'),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const circuits = pgTable("circuits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  circuitId: text("circuit_id").notNull().unique(),
  projectId: varchar("project_id").references(() => projects.id),
  siteName: text("site_name").notNull(),
  carrier: text("carrier").notNull(),
  locationType: text("location_type").notNull().default('Branch'), // Branch, Corporate, Data Center, Cloud
  serviceType: text("service_type").notNull(),
  circuitCategory: text("circuit_category").notNull().default('Internet'), // Internet, Private, Point-to-Point
  aLocation: text("a_location"), // For Point-to-Point circuits
  zLocation: text("z_location"), // For Point-to-Point circuits
  bandwidth: text("bandwidth").notNull(),
  bandwidthMbps: integer("bandwidth_mbps").notNull(),
  monthlyCost: decimal("monthly_cost", { precision: 10, scale: 2 }).notNull(),
  costPerMbps: decimal("cost_per_mbps", { precision: 8, scale: 2 }).notNull(),
  contractTerm: text("contract_term"),
  contractEndDate: timestamp("contract_end_date"),
  status: text("status").notNull().default('active'),
  optimizationStatus: text("optimization_status").notNull().default('pending'),
  notes: text("notes"),
  flags: jsonb("flags").default([]),
  siteFeatures: jsonb("site_features").default([]), // Array of features like ['redundant_circuits', 'sdwan_enabled', 'vpn_concentrator', 'hub_site']
  // Optional NaaS onramp attributes (without changing circuit type/category)
  naasEnabled: boolean("naas_enabled").default(false),
  naasProvider: text("naas_provider"), // Megaport | Equinix | Cato
  naasPopId: text("naas_pop_id"),
  naasPopName: text("naas_pop_name"),
  naasMetadata: jsonb("naas_metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  category: text("category").notNull(), // Branch, Corporate, Data Center, Cloud
  description: text("description"),
  coordinates: jsonb("coordinates").$type<{ x: number; y: number }>(),
  // Address fields
  streetAddress: text("street_address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").default("United States"),
  // Address validation fields
  addressValidated: boolean("address_validated").default(false),
  latitude: real("latitude"),
  longitude: real("longitude"),
  addressValidationResponse: jsonb("address_validation_response"),
  // NaaS Onramp selection
  naasOnramp: boolean("naas_onramp").default(false),
  naasProvider: text("naas_provider"), // Megaport | Equinix | Cato
  // Proximity analysis fields
  nearestMegaportPop: text("nearest_megaport_pop"),
  megaportDistance: real("megaport_distance"), // in miles
  megaportRegion: text("megaport_region"),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auditFlags = pgTable("audit_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  circuitId: varchar("circuit_id").references(() => circuits.id),
  flagType: text("flag_type").notNull(),
  severity: text("severity").notNull().default('medium'),
  title: text("title").notNull(),
  description: text("description").notNull(),
  isResolved: boolean("is_resolved").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Cloud Applications inventory (SaaS / Hyperscalers / Cloud apps)
export const cloudApps = pgTable("cloud_apps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  provider: text("provider"), // e.g., Microsoft, Google, AWS, Salesforce
  category: text("category").notNull().default('SaaS'), // SaaS | Hyperscaler | Cloud
  appType: text("app_type"), // e.g., IaaS, PaaS, UCaaS, CRM, ERP
  monthlyCost: decimal("monthly_cost", { precision: 10, scale: 2 }).default('0'),
  status: text("status").notNull().default('active'),
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  auditFlags: many(auditFlags),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  circuits: many(circuits),
  sites: many(sites),
}));

export const sitesRelations = relations(sites, ({ one }) => ({
  project: one(projects, {
    fields: [sites.projectId],
    references: [projects.id],
  }),
}));

export const circuitsRelations = relations(circuits, ({ one, many }) => ({
  project: one(projects, {
    fields: [circuits.projectId],
    references: [projects.id],
  }),
  auditFlags: many(auditFlags),
}));

export const auditFlagsRelations = relations(auditFlags, ({ one }) => ({
  circuit: one(circuits, {
    fields: [auditFlags.circuitId],
    references: [circuits.id],
  }),
  createdBy: one(users, {
    fields: [auditFlags.createdBy],
    references: [users.id],
  }),
}));

export const cloudAppsRelations = relations(cloudApps, ({ one }) => ({
  project: one(projects, {
    fields: [cloudApps.projectId],
    references: [projects.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  clientName: true,
  status: true,
  createdBy: true,
});

export const insertCircuitSchema = createInsertSchema(circuits).pick({
  circuitId: true,
  projectId: true,
  siteName: true,
  carrier: true,
  locationType: true,
  serviceType: true,
  circuitCategory: true,
  aLocation: true,
  zLocation: true,
  bandwidth: true,
  bandwidthMbps: true,
  monthlyCost: true,
  costPerMbps: true,
  siteFeatures: true,
  contractTerm: true,
  contractEndDate: true,
  status: true,
  optimizationStatus: true,
  notes: true,
  flags: true,
  // NaaS fields are optional on insert
  naasEnabled: true,
  naasProvider: true,
  naasPopId: true,
  naasPopName: true,
  naasMetadata: true,
});

export const insertSiteSchema = createInsertSchema(sites).pick({
  name: true,
  location: true,
  category: true,
  description: true,
  coordinates: true,
  streetAddress: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  naasOnramp: true,
  naasProvider: true,
  projectId: true,
});

export const insertAuditFlagSchema = createInsertSchema(auditFlags).pick({
  circuitId: true,
  flagType: true,
  severity: true,
  title: true,
  description: true,
  createdBy: true,
});

export const insertCloudAppSchema = createInsertSchema(cloudApps).pick({
  projectId: true,
  name: true,
  provider: true,
  category: true,
  appType: true,
  monthlyCost: true,
  status: true,
  notes: true,
  metadata: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Circuit = typeof circuits.$inferSelect;
export type InsertCircuit = z.infer<typeof insertCircuitSchema>;

export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;

export type AuditFlag = typeof auditFlags.$inferSelect;
export type InsertAuditFlag = z.infer<typeof insertAuditFlagSchema>;

export type CloudApp = typeof cloudApps.$inferSelect;
export type InsertCloudApp = z.infer<typeof insertCloudAppSchema>;