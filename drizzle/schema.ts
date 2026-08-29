import { boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const itemStatusValues = ["pending", "completed", "archived"] as const;
export const itemStatus = mysqlEnum("itemStatus", itemStatusValues);
export type ItemStatus = (typeof itemStatusValues)[number];

export const itemPriorityValues = ["critical", "high", "medium", "low"] as const;
export const itemPriority = mysqlEnum("itemPriority", itemPriorityValues);
export type ItemPriority = (typeof itemPriorityValues)[number];

export const familyGroups = mysqlTable("familyGroups", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  inviteCode: varchar("inviteCode", { length: 16 }).notNull().unique(),
  passwordHash: text("passwordHash"),
  createdBy: varchar("createdBy", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const shoppingLists = mysqlTable("shoppingLists", {
  id: varchar("id", { length: 32 }).primaryKey(),
  familyId: varchar("familyId", { length: 32 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  createdBy: varchar("createdBy", { length: 80 }).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("shoppingLists_family_idx").on(table.familyId)]);

export const shoppingItems = mysqlTable("shoppingItems", {
  id: varchar("id", { length: 32 }).primaryKey(),
  sharedItemId: varchar("sharedItemId", { length: 32 }),
  shoppingListId: varchar("shoppingListId", { length: 32 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  tagsJson: text("tagsJson").notNull(),
  priority: itemPriority.notNull().default("medium"),
  deadline: timestamp("deadline"),
  note: varchar("note", { length: 300 }),
  status: itemStatus.notNull().default("pending"),
  createdBy: varchar("createdBy", { length: 80 }).notNull(),
  completedBy: varchar("completedBy", { length: 80 }),
  completedAt: timestamp("completedAt"),
  archivedBy: varchar("archivedBy", { length: 80 }),
  archivedAt: timestamp("archivedAt"),
  archiveReason: varchar("archiveReason", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("shoppingItems_shared_idx").on(table.sharedItemId),
  index("shoppingItems_list_idx").on(table.shoppingListId),
  index("shoppingItems_status_idx").on(table.status),
  index("shoppingItems_priority_idx").on(table.priority),
]);

export const activities = mysqlTable("activities", {
  id: varchar("id", { length: 32 }).primaryKey(),
  familyId: varchar("familyId", { length: 32 }).notNull(),
  shoppingListId: varchar("shoppingListId", { length: 32 }),
  shoppingItemId: varchar("shoppingItemId", { length: 32 }),
  action: varchar("action", { length: 48 }).notNull(),
  actorName: varchar("actorName", { length: 80 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("activities_family_idx").on(table.familyId)]);

export type FamilyGroup = typeof familyGroups.$inferSelect;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type Activity = typeof activities.$inferSelect;
