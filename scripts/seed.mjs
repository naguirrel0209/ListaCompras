import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import mysql from "mysql2/promise";

const scrypt = promisify(scryptCallback);
const familyId = "fam_demo_familia";
const lists = [
  { id: "list_demo_semanal", name: "Compra semanal", createdBy: "Elena" },
  { id: "list_demo_farmacia", name: "Farmacia", createdBy: "Elena" },
  { id: "list_demo_hogar", name: "Ferretería", createdBy: "Pablo" },
];

async function hashPassword(value) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(value, salt, 64);
  return `${salt}:${derived.toString("base64url")}`;
}

function deadlineIn(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(12, 0, 0, 0);
  return value;
}

function item(id, listId, name, quantity, priority, deadline, note, tags, status, createdBy, details = {}) {
  return {
    id, listId, name, quantity, priority, deadline, note, tags: JSON.stringify(tags), status, createdBy,
    completedBy: details.completedBy ?? null,
    completedAt: details.completedBy ? new Date() : null,
    archivedBy: details.archivedBy ?? null,
    archivedAt: details.archivedBy ? new Date() : null,
    archiveReason: details.archiveReason ?? null,
  };
}

const items = [
  item("item_demo_manzanas", lists[0].id, "Manzanas rojas", "6.00", "medium", deadlineIn(2), "Elegir las más firmes para el desayuno.", ["desayuno", "fruta"], "pending", "Elena"),
  item("item_demo_leche", lists[0].id, "Leche fresca", "2.00", "high", deadlineIn(1), "Sin lactosa, por favor.", ["desayuno", "frío"], "pending", "Pablo"),
  item("item_demo_pasta", lists[0].id, "Pasta corta", "3.00", "low", deadlineIn(5), "Para las cenas de la semana.", ["cena"], "pending", "Elena"),
  item("item_demo_pan", lists[0].id, "Pan de masa madre", "1.00", "medium", deadlineIn(1), "Rebanado si tienen disponible.", ["fin de semana"], "completed", "Pablo", { completedBy: "Pablo" }),
  item("item_demo_vitaminas", lists[1].id, "Vitamina C", "1.00", "high", deadlineIn(1), "Revisar la dosis habitual.", ["invierno"], "pending", "Elena"),
  item("item_demo_tiritas", lists[1].id, "Tiritas", "1.00", "medium", deadlineIn(7), "Caja pequeña para el botiquín.", ["botiquín"], "completed", "Lucía", { completedBy: "Lucía" }),
  item("item_demo_pilas", lists[2].id, "Pilas AA", "8.00", "critical", deadlineIn(0), "Para el mando y el detector de humo.", ["urgente"], "pending", "Pablo"),
  item("item_demo_bombilla", lists[2].id, "Bombilla cálida", "2.00", "low", deadlineIn(14), "Casquillo E27.", ["salón"], "archived", "Elena", { archivedBy: "Elena", archiveReason: "Ya encontramos dos en el cajón" }),
];

async function seedLocalJson() {
  const localDbPath = path.resolve(process.cwd(), "data", "local-db.json");
  const now = new Date();
  let data = { familyGroups: [], shoppingLists: [], shoppingItems: [], activities: [] };

  try {
    data = JSON.parse(await readFile(localDbPath, "utf-8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const listIds = lists.map(list => list.id);
  data.familyGroups = data.familyGroups.filter(family => family.id !== familyId);
  data.shoppingLists = data.shoppingLists.filter(list => list.familyId !== familyId);
  data.shoppingItems = data.shoppingItems.filter(current => !listIds.includes(current.shoppingListId));
  data.activities = data.activities.filter(activity => activity.familyId !== familyId);

  data.familyGroups.push({
    id: familyId,
    name: "Casa Albor",
    inviteCode: "HOGAR-2026",
    passwordHash: await hashPassword("familia2026"),
    createdBy: "Elena",
    createdAt: now,
    updatedAt: now,
  });

  data.shoppingLists.push(...lists.map(list => ({
    id: list.id,
    familyId,
    name: list.name,
    createdBy: list.createdBy,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  })));

  data.shoppingItems.push(...items.map(current => ({
    id: current.id,
    shoppingListId: current.listId,
    name: current.name,
    quantity: current.quantity,
    category: "General",
    tagsJson: current.tags,
    priority: current.priority,
    deadline: current.deadline,
    note: current.note,
    status: current.status,
    createdBy: current.createdBy,
    completedBy: current.completedBy,
    completedAt: current.completedAt,
    archivedBy: current.archivedBy,
    archivedAt: current.archivedAt,
    archiveReason: current.archiveReason,
    createdAt: now,
    updatedAt: now,
  })));

  data.activities.push(
    {
      id: "act_demo_1",
      familyId,
      shoppingListId: lists[0].id,
      shoppingItemId: "item_demo_manzanas",
      action: "articulo_agregado",
      actorName: "Elena",
      description: "Agregó \"Manzanas rojas\" a la lista.",
      createdAt: now,
    },
    {
      id: "act_demo_2",
      familyId,
      shoppingListId: lists[0].id,
      shoppingItemId: "item_demo_pan",
      action: "articulo_completado",
      actorName: "Pablo",
      description: "Marcó \"Pan de masa madre\" como comprado.",
      createdAt: now,
    },
    {
      id: "act_demo_3",
      familyId,
      shoppingListId: lists[1].id,
      shoppingItemId: "item_demo_tiritas",
      action: "articulo_completado",
      actorName: "Lucía",
      description: "Marcó \"Tiritas\" como comprado.",
      createdAt: now,
    },
    {
      id: "act_demo_4",
      familyId,
      shoppingListId: lists[2].id,
      shoppingItemId: "item_demo_bombilla",
      action: "articulo_archivado",
      actorName: "Elena",
      description: "Retiró \"Bombilla cálida\" de la lista. Motivo: Ya encontramos dos en el cajón",
      createdAt: now,
    },
    {
      id: "act_demo_5",
      familyId,
      shoppingListId: lists[2].id,
      shoppingItemId: "item_demo_pilas",
      action: "articulo_agregado",
      actorName: "Pablo",
      description: "Agregó \"Pilas AA\" a la lista.",
      createdAt: now,
    },
  );

  await mkdir(path.dirname(localDbPath), { recursive: true });
  await writeFile(localDbPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(`Datos de demostración cargados correctamente en ${localDbPath}.`);
}

if (!process.env.DATABASE_URL) {
  await seedLocalJson();
  process.exit(0);
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.beginTransaction();
  await connection.execute("DELETE FROM activities WHERE familyId = ?", [familyId]);
  await connection.execute("DELETE FROM shoppingItems WHERE shoppingListId IN (?, ?, ?)", lists.map(list => list.id));
  await connection.execute("DELETE FROM shoppingLists WHERE familyId = ?", [familyId]);
  await connection.execute("DELETE FROM familyGroups WHERE id = ?", [familyId]);

  await connection.execute(
    "INSERT INTO familyGroups (id, name, inviteCode, passwordHash, createdBy) VALUES (?, ?, ?, ?, ?)",
    [familyId, "Casa Albor", "HOGAR-2026", await hashPassword("familia2026"), "Elena"],
  );

  for (const list of lists) {
    await connection.execute(
      "INSERT INTO shoppingLists (id, familyId, name, createdBy, isArchived) VALUES (?, ?, ?, ?, false)",
      [list.id, familyId, list.name, list.createdBy],
    );
  }

  for (const current of items) {
    await connection.execute(
      "INSERT INTO shoppingItems (id, shoppingListId, name, quantity, category, tagsJson, itemPriority, deadline, note, itemStatus, createdBy, completedBy, completedAt, archivedBy, archivedAt, archiveReason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [current.id, current.listId, current.name, current.quantity, "General", current.tags, current.priority, current.deadline, current.note, current.status, current.createdBy, current.completedBy, current.completedAt, current.archivedBy, current.archivedAt, current.archiveReason],
    );
  }

  const activities = [
    ["act_demo_1", lists[0].id, "item_demo_manzanas", "articulo_agregado", "Elena", "Agregó “Manzanas rojas” a la lista."],
    ["act_demo_2", lists[0].id, "item_demo_pan", "articulo_completado", "Pablo", "Marcó “Pan de masa madre” como comprado."],
    ["act_demo_3", lists[1].id, "item_demo_tiritas", "articulo_completado", "Lucía", "Marcó “Tiritas” como comprado."],
    ["act_demo_4", lists[2].id, "item_demo_bombilla", "articulo_archivado", "Elena", "Retiró “Bombilla cálida” de la lista. Motivo: Ya encontramos dos en el cajón"],
    ["act_demo_5", lists[2].id, "item_demo_pilas", "articulo_agregado", "Pablo", "Agregó “Pilas AA” a la lista."],
  ];
  for (const [id, listId, itemId, action, actorName, description] of activities) {
    await connection.execute(
      "INSERT INTO activities (id, familyId, shoppingListId, shoppingItemId, action, actorName, description) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, familyId, listId, itemId, action, actorName, description],
    );
  }
  await connection.commit();
  console.log("Datos de demostración cargados correctamente.");
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
