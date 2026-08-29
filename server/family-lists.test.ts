import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activities, familyGroups, shoppingItems, shoppingLists } from "../drizzle/schema";
import { getDb } from "./db";
import { writeFamilySession } from "./family-session";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

type CookieCall = { name: string; value: string };
const deadline = new Date("2030-01-15T12:00:00.000Z");

function createContext(cookie?: string) {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: cookie ? { cookie } : {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string) => cookies.push({ name, value }),
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

async function authenticatedCaller(familyId: string, memberName: string) {
  const initial = createContext();
  await writeFamilySession(initial.ctx.req, initial.ctx.res, { familyId, memberName });
  const token = initial.cookies[0]?.value;
  if (!token) throw new Error("No se pudo crear una sesión de prueba.");
  const session = createContext(`lista_familiar_session=${token}`);
  return appRouter.createCaller(session.ctx);
}

describe("procedimientos de Lista Familiar", () => {
  const trackedFamilyIds: string[] = [];
  const singleFamilyEnv = {
    mode: ENV.singleFamilyMode,
    inviteCode: ENV.singleFamilyInviteCode,
    id: ENV.singleFamilyId,
  };
  let familyId: string;
  let primaryListId: string;
  let caller: Awaited<ReturnType<typeof authenticatedCaller>>;

  function restoreSingleFamilyEnv() {
    ENV.singleFamilyMode = singleFamilyEnv.mode;
    ENV.singleFamilyInviteCode = singleFamilyEnv.inviteCode;
    ENV.singleFamilyId = singleFamilyEnv.id;
  }

  beforeAll(async () => {
    const creationContext = createContext();
    const created = await appRouter.createCaller(creationContext.ctx).family.create({
      familyName: "Familia Prueba",
      memberName: "Marina",
      password: "secreto-familiar",
      initialListName: "Compra de prueba",
    });
    familyId = created.family.id;
    primaryListId = created.firstList.id;
    trackedFamilyIds.push(familyId);
    caller = await authenticatedCaller(familyId, "Marina");
  });

  afterAll(async () => {
    restoreSingleFamilyEnv();

    const db = await getDb();
    if (!db || trackedFamilyIds.length === 0) return;
    const listRows = await db.select({ id: shoppingLists.id }).from(shoppingLists).where(inArray(shoppingLists.familyId, trackedFamilyIds));
    const listIds = listRows.map(row => row.id);
    if (listIds.length > 0) {
      await db.delete(shoppingItems).where(inArray(shoppingItems.shoppingListId, listIds));
      await db.delete(activities).where(inArray(activities.familyId, trackedFamilyIds));
      await db.delete(shoppingLists).where(inArray(shoppingLists.id, listIds));
    }
    await db.delete(familyGroups).where(inArray(familyGroups.id, trackedFamilyIds));
  });

  it("responde sin error cuando no hay sesión familiar activa", async () => {
    const anonymous = createContext();

    await expect(appRouter.createCaller(anonymous.ctx).family.current()).resolves.toBeNull();
  });

  it("crea una familia y una lista inicial con código compartible", async () => {
    const current = await caller.family.current();
    const lists = await caller.lists.all();

    if (!current) throw new Error("La sesión de prueba no devolvió familia.");
    expect(current.family.name).toBe("Familia Prueba");
    expect(current.family.inviteCode).toMatch(/^[A-Z]+-\d{4}$/);
    expect(current.family.hasPassword).toBe(true);
    expect(lists).toHaveLength(1);
    expect(lists[0]?.id).toBe(primaryListId);
  });

  it("rechaza una contraseña compartida incorrecta", async () => {
    const current = await caller.family.current();
    const anonymous = createContext();

    if (!current) throw new Error("La sesión de prueba no devolvió familia.");
    await expect(appRouter.createCaller(anonymous.ctx).family.join({
      inviteCode: current.family.inviteCode,
      password: "incorrecta",
      memberName: "Leo",
    })).rejects.toThrow("La contraseña no es correcta");
  });

  it("permite crear una lista adicional para la familia", async () => {
    const extraList = await caller.lists.create({ name: "Farmacia" });
    const lists = await caller.lists.all();

    expect(extraList.name).toBe("Farmacia");
    expect(lists.map(list => list.name)).toEqual(expect.arrayContaining(["Compra de prueba", "Farmacia"]));
  });

  it("elimina una lista de la familia y evita que reciba nuevos artículos", async () => {
    const removable = await caller.lists.create({ name: "Lista temporal" });
    await expect(caller.lists.remove({ listId: removable.id })).resolves.toMatchObject({ success: true });
    await expect(caller.items.create({ listId: removable.id, name: "No añadir", quantity: 1, priority: "low", deadline, tags: [] })).rejects.toThrow("No puedes agregar artículos");
    const lists = await caller.lists.all();
    expect(lists.some(list => list.id === removable.id)).toBe(false);
  });

  it("registra la incorporación y el cambio de nombre en el historial", async () => {
    const current = await caller.family.current();
    const joiningContext = createContext();

    if (!current) throw new Error("La sesión de prueba no devolvió familia.");
    await appRouter.createCaller(joiningContext.ctx).family.join({
      inviteCode: current.family.inviteCode,
      password: "secreto-familiar",
      memberName: "Leo",
    });
    await caller.lists.rename({ listId: primaryListId, name: "Compra semanal" });
    const activity = await caller.activities.recent({ limit: 20 });

    expect(activity.map(entry => entry.action)).toEqual(expect.arrayContaining(["miembro_ingreso", "lista_renombrada"]));
    expect(activity.find(entry => entry.action === "miembro_ingreso")?.actorName).toBe("Leo");
    expect(activity.find(entry => entry.action === "lista_renombrada")?.description).toContain("Compra semanal");
  });

  it("agrega un artículo con prioridad, fecha límite y comentario", async () => {
    const item = await caller.items.create({
      listId: primaryListId,
      name: "Leche fresca",
      quantity: 2,
      priority: "high",
      deadline,
      note: "Sin lactosa, por favor.",
      tags: ["desayuno", "frío"],
    });
    const filtered = await caller.items.all({ listId: primaryListId, priority: "high", sortBy: "priority" });

    expect(item.name).toBe("Leche fresca");
    expect(item.priority).toBe("high");
    expect(item.note).toBe("Sin lactosa, por favor.");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.item.tagsJson).toContain("desayuno");
  });

  it("rechaza artículos con cantidades inválidas", async () => {
    await expect(caller.items.create({
      listId: primaryListId,
      name: "Pan",
      quantity: 0,
      priority: "medium",
      deadline,
      tags: [],
    })).rejects.toThrow("La cantidad debe ser mayor que cero");
  });

  it("alterna un artículo entre pendiente y comprado", async () => {
    const created = await caller.items.create({ listId: primaryListId, name: "Café", quantity: 1, priority: "medium", deadline, tags: [] });
    const completed = await caller.items.toggle({ itemId: created.id });
    const restored = await caller.items.toggle({ itemId: created.id });

    expect(completed?.item.status).toBe("completed");
    expect(completed?.item.completedBy).toBe("Marina");
    expect(restored?.item.status).toBe("pending");
  });

  it("archiva con motivo y permite restaurar un artículo", async () => {
    const created = await caller.items.create({ listId: primaryListId, name: "Cereal", quantity: 1, priority: "low", deadline, tags: [] });
    const archived = await caller.items.archive({ itemId: created.id, reason: "Ya hay suficiente en casa" });
    const restored = await caller.items.restore({ itemId: created.id });

    expect(archived?.item.status).toBe("archived");
    expect(archived?.item.archiveReason).toBe("Ya hay suficiente en casa");
    expect(restored?.item.status).toBe("pending");
  });

  it("impide modificar artículos de otra familia", async () => {
    const otherContext = createContext();
    const other = await appRouter.createCaller(otherContext.ctx).family.create({
      familyName: "Otra Familia",
      memberName: "Raúl",
      initialListName: "Otra compra",
    });
    trackedFamilyIds.push(other.family.id);
    const otherCaller = await authenticatedCaller(other.family.id, "Raúl");
    const item = await otherCaller.items.create({ listId: other.firstList.id, name: "Pilas", quantity: 4, priority: "critical", deadline, tags: [] });

    await expect(caller.items.update({ itemId: item.id, name: "Pilas AA" })).rejects.toThrow("No encontramos ese artículo");
  });

  it("permite entrar a la familia única configurada por código de invitación", async () => {
    const current = await caller.family.current();
    const accessContext = createContext();

    if (!current) throw new Error("La sesión de prueba no devolvió familia.");
    ENV.singleFamilyMode = true;
    ENV.singleFamilyInviteCode = current.family.inviteCode;
    ENV.singleFamilyId = "";

    try {
      const result = await appRouter.createCaller(accessContext.ctx).family.singleAccess({ memberName: "Ana" });
      const token = accessContext.cookies[0]?.value;
      if (!token) throw new Error("El acceso único no creó una cookie de sesión.");

      const singleCaller = appRouter.createCaller(createContext(`lista_familiar_session=${token}`).ctx);
      const session = await singleCaller.family.current();
      const activity = await caller.activities.recent({ limit: 20 });

      expect(result.family.id).toBe(current.family.id);
      expect(result.family.hasPassword).toBe(true);
      expect("passwordHash" in result.family).toBe(false);
      expect(session?.memberName).toBe("Ana");
      expect(activity.some(entry => entry.action === "miembro_ingreso" && entry.actorName === "Ana")).toBe(true);
    } finally {
      restoreSingleFamilyEnv();
    }
  });

  it("permite entrar a la familia única configurada por id", async () => {
    const current = await caller.family.current();
    const accessContext = createContext();

    if (!current) throw new Error("La sesión de prueba no devolvió familia.");
    ENV.singleFamilyMode = true;
    ENV.singleFamilyInviteCode = "";
    ENV.singleFamilyId = current.family.id;

    try {
      const result = await appRouter.createCaller(accessContext.ctx).family.singleAccess({ memberName: "Sofía" });

      expect(result.family.id).toBe(current.family.id);
      expect(result.memberName).toBe("Sofía");
    } finally {
      restoreSingleFamilyEnv();
    }
  });

  it("rechaza sesiones de otra familia cuando el modo de familia única está activo", async () => {
    const current = await caller.family.current();
    const otherContext = createContext();

    if (!current) throw new Error("La sesión de prueba no devolvió familia.");
    const other = await appRouter.createCaller(otherContext.ctx).family.create({
      familyName: "Familia Externa",
      memberName: "Tomás",
      initialListName: "Compra externa",
    });
    trackedFamilyIds.push(other.family.id);
    const otherCaller = await authenticatedCaller(other.family.id, "Tomás");

    ENV.singleFamilyMode = true;
    ENV.singleFamilyInviteCode = current.family.inviteCode;
    ENV.singleFamilyId = "";

    try {
      await expect(otherCaller.lists.all()).rejects.toThrow("Esta sesión no pertenece a la familia configurada");
    } finally {
      restoreSingleFamilyEnv();
    }
  });
});
