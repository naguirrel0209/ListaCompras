import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  activities,
  familyGroups,
  shoppingItems,
  shoppingLists,
  type ItemPriority,
  type ItemStatus,
} from "../drizzle/schema";
import { getDb } from "./db";
import * as localRepository from "./local-repository";

export type ItemFilters = {
  listId?: string;
  status?: ItemStatus | "all";
  priority?: ItemPriority;
  tag?: string;
  search?: string;
  sortBy?: "priority" | "deadline" | "newest" | "oldest" | "nameAsc" | "nameDesc";
};

function id(prefix: string) {
  return `${prefix}_${nanoid(16)}`;
}

function useLocalRepository() {
  return !process.env.DATABASE_URL;
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible.");
  return db;
}

export async function findFamilyByInviteCode(code: string) {
  if (useLocalRepository()) return localRepository.findFamilyByInviteCode(code);
  const db = await database();
  const result = await db.select().from(familyGroups).where(eq(familyGroups.inviteCode, code)).limit(1);
  return result[0];
}

export async function findFamilyById(id: string) {
  if (useLocalRepository()) return localRepository.findFamilyById(id);
  const db = await database();
  const result = await db.select().from(familyGroups).where(eq(familyGroups.id, id)).limit(1);
  return result[0];
}

export async function inviteCodeExists(code: string) {
  return Boolean(await findFamilyByInviteCode(code));
}

export async function createFamily(input: {
  name: string;
  passwordHash: string | null;
  createdBy: string;
  inviteCode: string;
  initialListName: string;
}) {
  if (useLocalRepository()) return localRepository.createFamily(input);
  const db = await database();
  const now = new Date();
  const family = {
    id: id("fam"),
    name: input.name,
    inviteCode: input.inviteCode,
    passwordHash: input.passwordHash,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  const firstList = {
    id: id("list"),
    familyId: family.id,
    name: input.initialListName,
    createdBy: input.createdBy,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(async tx => {
    await tx.insert(familyGroups).values(family);
    await tx.insert(shoppingLists).values(firstList);
    await tx.insert(activities).values({
      id: id("act"),
      familyId: family.id,
      shoppingListId: firstList.id,
      shoppingItemId: null,
      action: "lista_creada",
      actorName: input.createdBy,
      description: `Creó la lista “${firstList.name}”.`,
      createdAt: now,
    });
  });

  return { family, firstList };
}

export async function getFamilyLists(familyId: string, includeArchived = false) {
  if (useLocalRepository()) return localRepository.getFamilyLists(familyId, includeArchived);
  const db = await database();
  const condition = includeArchived
    ? eq(shoppingLists.familyId, familyId)
    : and(eq(shoppingLists.familyId, familyId), eq(shoppingLists.isArchived, false));
  return db.select().from(shoppingLists).where(condition).orderBy(asc(shoppingLists.createdAt));
}

export async function getListForFamily(listId: string, familyId: string) {
  if (useLocalRepository()) return localRepository.getListForFamily(listId, familyId);
  const db = await database();
  const result = await db
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.familyId, familyId), eq(shoppingLists.isArchived, false)))
    .limit(1);
  return result[0];
}

export async function createShoppingList(input: { familyId: string; name: string; createdBy: string }) {
  if (useLocalRepository()) return localRepository.createShoppingList(input);
  const db = await database();
  const now = new Date();
  const list = {
    id: id("list"),
    familyId: input.familyId,
    name: input.name,
    createdBy: input.createdBy,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction(async tx => {
    await tx.insert(shoppingLists).values(list);
    await tx.insert(activities).values({
      id: id("act"), familyId: input.familyId, shoppingListId: list.id, shoppingItemId: null,
      action: "lista_creada", actorName: input.createdBy,
      description: `Creó la lista “${list.name}”.`, createdAt: now,
    });
  });
  return list;
}

export async function renameShoppingList(input: { familyId: string; listId: string; name: string; actorName: string }) {
  if (useLocalRepository()) return localRepository.renameShoppingList(input);
  const db = await database();
  const now = new Date();
  await db.update(shoppingLists).set({ name: input.name, updatedAt: now }).where(eq(shoppingLists.id, input.listId));
  const list = await getListById(input.listId);
  if (list) {
    await recordActivity({
      familyId: input.familyId,
      listId: list.id,
      itemId: null,
      action: "lista_renombrada",
      actorName: input.actorName,
      description: `Cambió el nombre de la lista a “${list.name}”.`,
    });
  }
  return list;
}

export async function removeShoppingList(input: { familyId: string; listId: string; actorName: string }) {
  if (useLocalRepository()) return localRepository.removeShoppingList(input);
  const list = await getListForFamily(input.listId, input.familyId);
  if (!list) return undefined;
  const db = await database();
  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(shoppingLists).set({ isArchived: true, updatedAt: now }).where(eq(shoppingLists.id, input.listId));
    await tx.insert(activities).values({
      id: id("act"), familyId: input.familyId, shoppingListId: input.listId, shoppingItemId: null,
      action: "lista_eliminada", actorName: input.actorName,
      description: `Eliminó la lista “${list.name}”.`, createdAt: now,
    });
  });
  return list;
}

async function getListById(listId: string) {
  const db = await database();
  const result = await db.select().from(shoppingLists).where(eq(shoppingLists.id, listId)).limit(1);
  return result[0];
}

export async function getItemsForFamily(familyId: string, filters: ItemFilters) {
  if (useLocalRepository()) return localRepository.getItemsForFamily(familyId, filters);
  const db = await database();
  const conditions = [eq(shoppingLists.familyId, familyId)];
  if (filters.listId) conditions.push(eq(shoppingItems.shoppingListId, filters.listId));
  if (filters.status && filters.status !== "all") conditions.push(eq(shoppingItems.status, filters.status));
  if (filters.priority) conditions.push(eq(shoppingItems.priority, filters.priority));
  if (filters.tag) conditions.push(like(shoppingItems.tagsJson, `%${filters.tag}%`));
  if (filters.search) {
    conditions.push(or(like(shoppingItems.name, `%${filters.search}%`), like(shoppingItems.note, `%${filters.search}%`))!);
  }

  const base = db
    .select({ item: shoppingItems, listName: shoppingLists.name })
    .from(shoppingItems)
    .innerJoin(shoppingLists, eq(shoppingItems.shoppingListId, shoppingLists.id))
    .where(and(...conditions));

  switch (filters.sortBy) {
    case "oldest": return base.orderBy(asc(shoppingItems.createdAt));
    case "nameAsc": return base.orderBy(asc(shoppingItems.name));
    case "nameDesc": return base.orderBy(desc(shoppingItems.name));
    case "priority": return base.orderBy(sql`FIELD(${shoppingItems.priority}, 'critical', 'high', 'medium', 'low')`, asc(shoppingItems.deadline));
    case "deadline": return base.orderBy(asc(shoppingItems.deadline));
    case "newest":
    default: return base.orderBy(desc(shoppingItems.createdAt));
  }
}

export async function getItemForFamily(itemId: string, familyId: string) {
  if (useLocalRepository()) return localRepository.getItemForFamily(itemId, familyId);
  const db = await database();
  const result = await db
    .select({ item: shoppingItems, listName: shoppingLists.name })
    .from(shoppingItems)
    .innerJoin(shoppingLists, eq(shoppingItems.shoppingListId, shoppingLists.id))
    .where(and(eq(shoppingItems.id, itemId), eq(shoppingLists.familyId, familyId)))
    .limit(1);
  return result[0];
}

export async function createShoppingItem(input: {
  familyId: string; shoppingListId: string; shoppingListIds?: string[]; name: string; quantity?: number; priority: ItemPriority;
  deadline: Date | null; note?: string; tags: string[]; createdBy: string;
}) {
  if (useLocalRepository()) return localRepository.createShoppingItem(input);
  const db = await database();
  const now = new Date();
  const shoppingListIds = Array.from(new Set([...(input.shoppingListIds ?? []), input.shoppingListId]));
  const sharedItemId = id("share");
  const items = shoppingListIds.map(shoppingListId => ({
    id: id("item"), sharedItemId, shoppingListId, name: input.name, quantity: (input.quantity ?? 1).toFixed(2),
    category: "General", tagsJson: JSON.stringify(input.tags), priority: input.priority, deadline: input.deadline, note: input.note?.trim() || null, status: "pending" as const,
    createdBy: input.createdBy, completedBy: null, completedAt: null, archivedBy: null, archivedAt: null,
    archiveReason: null, createdAt: now, updatedAt: now,
  }));
  await db.transaction(async tx => {
    await tx.insert(shoppingItems).values(items);
    await tx.insert(activities).values(items.map(item => ({
      id: id("act"), familyId: input.familyId, shoppingListId: item.shoppingListId, shoppingItemId: item.id,
      action: "articulo_agregado", actorName: input.createdBy,
      description: `Agregó “${item.name}” a la lista.`, createdAt: now,
    })));
  });
  return items[0];
}

export async function updateShoppingItem(input: {
  familyId: string; itemId: string; name?: string; quantity?: number; priority?: ItemPriority; deadline?: Date | null; note?: string; tags?: string[]; actorName: string;
}) {
  if (useLocalRepository()) return localRepository.updateShoppingItem(input);
  const item = await getItemForFamily(input.itemId, input.familyId);
  if (!item) return undefined;
  const db = await database();
  const changes: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) changes.name = input.name;
  if (input.quantity !== undefined) changes.quantity = input.quantity.toFixed(2);
  if (input.priority !== undefined) changes.priority = input.priority;
  if (input.deadline !== undefined) changes.deadline = input.deadline;
  if (input.note !== undefined) changes.note = input.note.trim() || null;
  if (input.tags !== undefined) changes.tagsJson = JSON.stringify(input.tags);
  const sharedItemId = item.item.sharedItemId ?? item.item.id;
  const sharedRows = await db
    .select({ id: shoppingItems.id })
    .from(shoppingItems)
    .innerJoin(shoppingLists, eq(shoppingItems.shoppingListId, shoppingLists.id))
    .where(and(eq(shoppingLists.familyId, input.familyId), eq(shoppingItems.sharedItemId, sharedItemId)));
  const itemIds = sharedRows.length > 0 ? sharedRows.map(row => row.id) : [input.itemId];

  await db.update(shoppingItems).set(changes).where(inArray(shoppingItems.id, itemIds));
  const updated = await getItemForFamily(input.itemId, input.familyId);
  if (!updated) return undefined;
  await recordActivity({ familyId: input.familyId, listId: updated.item.shoppingListId, itemId: input.itemId, action: "articulo_editado", actorName: input.actorName, description: `Editó “${updated.item.name}”.` });
  return updated;
}

export async function setItemStatus(input: {
  familyId: string; itemId: string; status: ItemStatus; actorName: string; reason?: string;
}) {
  if (useLocalRepository()) return localRepository.setItemStatus(input);
  const itemWithList = await getItemForFamily(input.itemId, input.familyId);
  if (!itemWithList) return undefined;
  const db = await database();
  const now = new Date();
  const changes = input.status === "completed"
    ? { status: input.status, completedBy: input.actorName, completedAt: now, updatedAt: now }
    : input.status === "archived"
      ? { status: input.status, archivedBy: input.actorName, archivedAt: now, archiveReason: input.reason ?? null, updatedAt: now }
      : { status: input.status, completedBy: null, completedAt: null, archivedBy: null, archivedAt: null, archiveReason: null, updatedAt: now };
  await db.update(shoppingItems).set(changes).where(eq(shoppingItems.id, input.itemId));
  const action = input.status === "completed" ? "articulo_completado" : input.status === "archived" ? "articulo_archivado" : "articulo_restaurado";
  const description = input.status === "completed"
    ? `Marcó “${itemWithList.item.name}” como comprado.`
    : input.status === "archived"
      ? `Retiró “${itemWithList.item.name}” de la lista.${input.reason ? ` Motivo: ${input.reason}` : ""}`
      : `Devolvió “${itemWithList.item.name}” a pendientes.`;
  await recordActivity({ familyId: input.familyId, listId: itemWithList.item.shoppingListId, itemId: input.itemId, action, actorName: input.actorName, description });
  return getItemForFamily(input.itemId, input.familyId);
}

export async function recordActivity(input: { familyId: string; listId: string | null; itemId: string | null; action: string; actorName: string; description: string }) {
  if (useLocalRepository()) return localRepository.recordActivity(input);
  const db = await database();
  await db.insert(activities).values({
    id: id("act"), familyId: input.familyId, shoppingListId: input.listId, shoppingItemId: input.itemId,
    action: input.action, actorName: input.actorName, description: input.description, createdAt: new Date(),
  });
}

export async function getActivitiesForFamily(familyId: string, limit = 20) {
  if (useLocalRepository()) return localRepository.getActivitiesForFamily(familyId, limit);
  const db = await database();
  return db.select().from(activities).where(eq(activities.familyId, familyId)).orderBy(desc(activities.createdAt)).limit(limit);
}
