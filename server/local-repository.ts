import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { ItemFilters } from "./family-repository";
import type { ItemPriority, ItemStatus } from "../drizzle/schema";

type FamilyGroup = {
  id: string;
  name: string;
  inviteCode: string;
  passwordHash: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type ShoppingList = {
  id: string;
  familyId: string;
  name: string;
  createdBy: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ShoppingItem = {
  id: string;
  sharedItemId?: string | null;
  shoppingListId: string;
  name: string;
  quantity: string;
  category: string;
  tagsJson: string;
  priority: ItemPriority;
  deadline: Date | null;
  note: string | null;
  status: ItemStatus;
  createdBy: string;
  completedBy: string | null;
  completedAt: Date | null;
  archivedBy: string | null;
  archivedAt: Date | null;
  archiveReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Activity = {
  id: string;
  familyId: string;
  shoppingListId: string | null;
  shoppingItemId: string | null;
  action: string;
  actorName: string;
  description: string;
  createdAt: Date;
};

type LocalData = {
  familyGroups: FamilyGroup[];
  shoppingLists: ShoppingList[];
  shoppingItems: ShoppingItem[];
  activities: Activity[];
};

const DATA_PATH = path.resolve(process.cwd(), process.env.LOCAL_DATA_FILE ?? "data/local-db.json");
const dateFields = new Set([
  "createdAt",
  "updatedAt",
  "deadline",
  "completedAt",
  "archivedAt",
]);

function blankData(): LocalData {
  return { familyGroups: [], shoppingLists: [], shoppingItems: [], activities: [] };
}

function localId(prefix: string) {
  return `${prefix}_${nanoid(16)}`;
}

function reviveDates(key: string, value: unknown) {
  if (dateFields.has(key) && typeof value === "string") return new Date(value);
  return value;
}

async function readData(): Promise<LocalData> {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    return JSON.parse(raw, reviveDates) as LocalData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return blankData();
    throw error;
  }
}

async function writeData(data: LocalData) {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function byCreatedAsc(a: { createdAt: Date }, b: { createdAt: Date }) {
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function byCreatedDesc(a: { createdAt: Date }, b: { createdAt: Date }) {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function priorityRank(priority: ItemPriority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority];
}

export async function findFamilyByInviteCode(code: string) {
  const data = await readData();
  return data.familyGroups.find(family => family.inviteCode === code);
}

export async function findFamilyById(id: string) {
  const data = await readData();
  return data.familyGroups.find(family => family.id === id);
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
  const data = await readData();
  const now = new Date();
  const family: FamilyGroup = {
    id: localId("fam"),
    name: input.name,
    inviteCode: input.inviteCode,
    passwordHash: input.passwordHash,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  const firstList: ShoppingList = {
    id: localId("list"),
    familyId: family.id,
    name: input.initialListName,
    createdBy: input.createdBy,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  data.familyGroups.push(family);
  data.shoppingLists.push(firstList);
  data.activities.push({
    id: localId("act"),
    familyId: family.id,
    shoppingListId: firstList.id,
    shoppingItemId: null,
    action: "lista_creada",
    actorName: input.createdBy,
    description: `Creó la lista "${firstList.name}".`,
    createdAt: now,
  });
  await writeData(data);
  return { family, firstList };
}

export async function getFamilyLists(familyId: string, includeArchived = false) {
  const data = await readData();
  return data.shoppingLists
    .filter(list => list.familyId === familyId && (includeArchived || !list.isArchived))
    .sort(byCreatedAsc);
}

export async function getListForFamily(listId: string, familyId: string) {
  const data = await readData();
  return data.shoppingLists.find(list => list.id === listId && list.familyId === familyId && !list.isArchived);
}

export async function createShoppingList(input: { familyId: string; name: string; createdBy: string }) {
  const data = await readData();
  const now = new Date();
  const list: ShoppingList = {
    id: localId("list"),
    familyId: input.familyId,
    name: input.name,
    createdBy: input.createdBy,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  data.shoppingLists.push(list);
  data.activities.push({
    id: localId("act"),
    familyId: input.familyId,
    shoppingListId: list.id,
    shoppingItemId: null,
    action: "lista_creada",
    actorName: input.createdBy,
    description: `Creó la lista "${list.name}".`,
    createdAt: now,
  });
  await writeData(data);
  return list;
}

export async function renameShoppingList(input: { familyId: string; listId: string; name: string; actorName: string }) {
  const data = await readData();
  const list = data.shoppingLists.find(current => current.id === input.listId && current.familyId === input.familyId);
  if (!list) return undefined;

  list.name = input.name;
  list.updatedAt = new Date();
  data.activities.push({
    id: localId("act"),
    familyId: input.familyId,
    shoppingListId: list.id,
    shoppingItemId: null,
    action: "lista_renombrada",
    actorName: input.actorName,
    description: `Cambió el nombre de la lista a "${list.name}".`,
    createdAt: new Date(),
  });
  await writeData(data);
  return list;
}

export async function removeShoppingList(input: { familyId: string; listId: string; actorName: string }) {
  const data = await readData();
  const list = data.shoppingLists.find(current => current.id === input.listId && current.familyId === input.familyId && !current.isArchived);
  if (!list) return undefined;

  list.isArchived = true;
  list.updatedAt = new Date();
  data.activities.push({
    id: localId("act"),
    familyId: input.familyId,
    shoppingListId: list.id,
    shoppingItemId: null,
    action: "lista_eliminada",
    actorName: input.actorName,
    description: `Eliminó la lista "${list.name}".`,
    createdAt: new Date(),
  });
  await writeData(data);
  return list;
}

export async function getItemsForFamily(familyId: string, filters: ItemFilters) {
  const data = await readData();
  const listsById = new Map(data.shoppingLists.filter(list => list.familyId === familyId).map(list => [list.id, list]));
  let rows = data.shoppingItems
    .filter(item => listsById.has(item.shoppingListId))
    .map(item => ({ item, listName: listsById.get(item.shoppingListId)?.name ?? "" }));

  if (filters.listId) rows = rows.filter(row => row.item.shoppingListId === filters.listId);
  if (filters.status && filters.status !== "all") rows = rows.filter(row => row.item.status === filters.status);
  if (filters.priority) rows = rows.filter(row => row.item.priority === filters.priority);
  if (filters.tag) rows = rows.filter(row => row.item.tagsJson.toLowerCase().includes(filters.tag!.toLowerCase()));
  if (filters.search) {
    const search = filters.search.toLowerCase();
    rows = rows.filter(row => row.item.name.toLowerCase().includes(search) || (row.item.note ?? "").toLowerCase().includes(search));
  }

  switch (filters.sortBy) {
    case "oldest":
      return rows.sort((a, b) => byCreatedAsc(a.item, b.item));
    case "nameAsc":
      return rows.sort((a, b) => a.item.name.localeCompare(b.item.name, "es"));
    case "nameDesc":
      return rows.sort((a, b) => b.item.name.localeCompare(a.item.name, "es"));
    case "priority":
      return rows.sort((a, b) => priorityRank(a.item.priority) - priorityRank(b.item.priority) || deadlineTime(a.item) - deadlineTime(b.item));
    case "deadline":
      return rows.sort((a, b) => deadlineTime(a.item) - deadlineTime(b.item));
    case "newest":
    default:
      return rows.sort((a, b) => byCreatedDesc(a.item, b.item));
  }
}

function deadlineTime(item: ShoppingItem) {
  return item.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

export async function getItemForFamily(itemId: string, familyId: string) {
  const data = await readData();
  const item = data.shoppingItems.find(current => current.id === itemId);
  if (!item) return undefined;
  const list = data.shoppingLists.find(current => current.id === item.shoppingListId && current.familyId === familyId);
  if (!list) return undefined;
  return { item, listName: list.name };
}

export async function createShoppingItem(input: {
  familyId: string;
  shoppingListId: string;
  shoppingListIds?: string[];
  name: string;
  quantity?: number;
  priority: ItemPriority;
  deadline: Date | null;
  note?: string;
  tags: string[];
  createdBy: string;
}) {
  const data = await readData();
  const now = new Date();
  const shoppingListIds = Array.from(new Set([...(input.shoppingListIds ?? []), input.shoppingListId]));
  const sharedItemId = localId("share");
  const items: ShoppingItem[] = shoppingListIds.map(shoppingListId => ({
    id: localId("item"),
    sharedItemId,
    shoppingListId,
    name: input.name,
    quantity: (input.quantity ?? 1).toFixed(2),
    category: "General",
    tagsJson: JSON.stringify(input.tags),
    priority: input.priority,
    deadline: input.deadline,
    note: input.note?.trim() || null,
    status: "pending",
    createdBy: input.createdBy,
    completedBy: null,
    completedAt: null,
    archivedBy: null,
    archivedAt: null,
    archiveReason: null,
    createdAt: now,
    updatedAt: now,
  }));

  data.shoppingItems.push(...items);
  data.activities.push(...items.map(item => ({
    id: localId("act"),
    familyId: input.familyId,
    shoppingListId: item.shoppingListId,
    shoppingItemId: item.id,
    action: "articulo_agregado",
    actorName: input.createdBy,
    description: `Agregó "${item.name}" a la lista.`,
    createdAt: now,
  })));
  await writeData(data);
  return items[0];
}

export async function updateShoppingItem(input: {
  familyId: string;
  itemId: string;
  name?: string;
  quantity?: number;
  priority?: ItemPriority;
  deadline?: Date | null;
  note?: string;
  tags?: string[];
  actorName: string;
}) {
  const data = await readData();
  const item = data.shoppingItems.find(current => current.id === input.itemId);
  const list = item ? data.shoppingLists.find(current => current.id === item.shoppingListId && current.familyId === input.familyId) : undefined;
  if (!item || !list) return undefined;

  const familyListIds = new Set(data.shoppingLists.filter(current => current.familyId === input.familyId).map(current => current.id));
  const sharedItemId = item.sharedItemId ?? item.id;
  const sharedItems = data.shoppingItems.filter(current => familyListIds.has(current.shoppingListId) && (current.sharedItemId ?? current.id) === sharedItemId);
  const updatedAt = new Date();
  for (const current of sharedItems) {
    if (input.name !== undefined) current.name = input.name;
    if (input.quantity !== undefined) current.quantity = input.quantity.toFixed(2);
    if (input.priority !== undefined) current.priority = input.priority;
    if (input.deadline !== undefined) current.deadline = input.deadline;
    if (input.note !== undefined) current.note = input.note.trim() || null;
    if (input.tags !== undefined) current.tagsJson = JSON.stringify(input.tags);
    current.updatedAt = updatedAt;
  }

  data.activities.push({
    id: localId("act"),
    familyId: input.familyId,
    shoppingListId: item.shoppingListId,
    shoppingItemId: item.id,
    action: "articulo_editado",
    actorName: input.actorName,
    description: `Editó "${item.name}".`,
    createdAt: new Date(),
  });
  await writeData(data);
  return { item, listName: list.name };
}

export async function setItemStatus(input: {
  familyId: string;
  itemId: string;
  status: ItemStatus;
  actorName: string;
  reason?: string;
}) {
  const data = await readData();
  const item = data.shoppingItems.find(current => current.id === input.itemId);
  const list = item ? data.shoppingLists.find(current => current.id === item.shoppingListId && current.familyId === input.familyId) : undefined;
  if (!item || !list) return undefined;

  const now = new Date();
  item.status = input.status;
  item.updatedAt = now;
  if (input.status === "completed") {
    item.completedBy = input.actorName;
    item.completedAt = now;
  } else if (input.status === "archived") {
    item.archivedBy = input.actorName;
    item.archivedAt = now;
    item.archiveReason = input.reason ?? null;
  } else {
    item.completedBy = null;
    item.completedAt = null;
    item.archivedBy = null;
    item.archivedAt = null;
    item.archiveReason = null;
  }

  const action = input.status === "completed" ? "articulo_completado" : input.status === "archived" ? "articulo_archivado" : "articulo_restaurado";
  const description = input.status === "completed"
    ? `Marcó "${item.name}" como comprado.`
    : input.status === "archived"
      ? `Retiró "${item.name}" de la lista.${input.reason ? ` Motivo: ${input.reason}` : ""}`
      : `Devolvió "${item.name}" a pendientes.`;

  data.activities.push({
    id: localId("act"),
    familyId: input.familyId,
    shoppingListId: item.shoppingListId,
    shoppingItemId: item.id,
    action,
    actorName: input.actorName,
    description,
    createdAt: now,
  });
  await writeData(data);
  return { item, listName: list.name };
}

export async function recordActivity(input: {
  familyId: string;
  listId: string | null;
  itemId: string | null;
  action: string;
  actorName: string;
  description: string;
}) {
  const data = await readData();
  data.activities.push({
    id: localId("act"),
    familyId: input.familyId,
    shoppingListId: input.listId,
    shoppingItemId: input.itemId,
    action: input.action,
    actorName: input.actorName,
    description: input.description,
    createdAt: new Date(),
  });
  await writeData(data);
}

export async function getActivitiesForFamily(familyId: string, limit = 20) {
  const data = await readData();
  return data.activities
    .filter(activity => activity.familyId === familyId)
    .sort(byCreatedDesc)
    .slice(0, limit);
}
