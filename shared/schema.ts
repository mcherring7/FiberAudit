import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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
  carrier: text("carrier").notNull(),
  location: text("location").notNull(),
  serviceType: text("service_type").notNull(),
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
  carrier: true,
  location: true,
  serviceType: true,
  bandwidth: true,
  bandwidthMbps: true,
  monthlyCost: true,
  costPerMbps: true,
  contractTerm: true,
  contractEndDate: true,
  status: true,
  optimizationStatus: true,
  notes: true,
  flags: true,
});

export const insertAuditFlagSchema = createInsertSchema(auditFlags).pick({
  circuitId: true,
  flagType: true,
  severity: true,
  title: true,
  description: true,
  createdBy: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Circuit = typeof circuits.$inferSelect;
export type InsertCircuit = z.infer<typeof insertCircuitSchema>;

export type AuditFlag = typeof auditFlags.$inferSelect;
export type InsertAuditFlag = z.infer<typeof insertAuditFlagSchema>;
