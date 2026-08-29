import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createShoppingItem, getItemForFamily, getItemsForFamily, getListForFamily, setItemStatus, updateShoppingItem } from "../family-repository";
import { familyProcedure, router } from "../_core/trpc";

const itemName = z.string().trim().min(1, "Escribe el nombre del artículo.").max(120, "El nombre es demasiado largo.");
const tags = z.array(z.string().trim().min(1).max(24)).max(5).default([]);
const priority = z.enum(["critical", "high", "medium", "low"]);
const deadline = z.preprocess(
  value => value === null || value === "" ? null : value,
  z.coerce.date({ error: "Elige una fecha límite válida." }).nullable(),
);
const note = z.string().trim().max(300, "El comentario no puede superar 300 caracteres.").optional();
const listIds = z.array(z.string().min(1)).max(20, "Selecciona menos listas.").optional();

function uniqueListIds(input: { listId?: string; listIds?: string[] }) {
  return Array.from(new Set([...(input.listIds ?? []), ...(input.listId ? [input.listId] : [])]));
}

export const itemsRouter = router({
  all: familyProcedure.input(z.object({
    listId: z.string().min(1).optional(), status: z.enum(["pending", "completed", "archived", "all"]).optional(),
    priority: priority.optional(), tag: z.string().min(1).optional(), search: z.string().max(120).optional(),
    sortBy: z.enum(["priority", "deadline", "newest", "oldest", "nameAsc", "nameDesc"]).optional(),
  }).optional()).query(({ ctx, input }) => getItemsForFamily(ctx.familySession.familyId, input ?? {})),

  create: familyProcedure.input(z.object({
    listId: z.string().min(1).optional(),
    listIds,
    name: itemName,
    priority,
    deadline: deadline.optional(),
    note,
    tags,
  }).refine(input => uniqueListIds(input).length > 0, "Selecciona al menos una lista.")).mutation(async ({ ctx, input }) => {
    const selectedListIds = uniqueListIds(input);
    const lists = await Promise.all(selectedListIds.map(listId => getListForFamily(listId, ctx.familySession.familyId)));
    if (lists.some(list => !list)) throw new TRPCError({ code: "FORBIDDEN", message: "No puedes agregar artículos a una lista que no pertenece a tu familia." });
    return createShoppingItem({ familyId: ctx.familySession.familyId, shoppingListId: selectedListIds[0]!, shoppingListIds: selectedListIds, name: input.name, priority: input.priority, deadline: input.deadline ?? null, note: input.note, tags: input.tags, createdBy: ctx.familySession.memberName });
  }),

  update: familyProcedure.input(z.object({ itemId: z.string().min(1), name: itemName.optional(), priority: priority.optional(), deadline: deadline.optional(), note, tags: tags.optional() })).mutation(async ({ ctx, input }) => {
    const item = await getItemForFamily(input.itemId, ctx.familySession.familyId);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos ese artículo." });
    return updateShoppingItem({ familyId: ctx.familySession.familyId, actorName: ctx.familySession.memberName, ...input });
  }),

  toggle: familyProcedure.input(z.object({ itemId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const item = await getItemForFamily(input.itemId, ctx.familySession.familyId);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos ese artículo." });
    if (item.item.status === "archived") throw new TRPCError({ code: "BAD_REQUEST", message: "Restaura el artículo antes de marcarlo como comprado." });
    const status = item.item.status === "completed" ? "pending" : "completed";
    return setItemStatus({ familyId: ctx.familySession.familyId, itemId: input.itemId, status, actorName: ctx.familySession.memberName });
  }),

  archive: familyProcedure.input(z.object({ itemId: z.string().min(1), reason: z.string().trim().min(3, "Explica brevemente por qué se retira.").max(160) })).mutation(async ({ ctx, input }) => {
    const item = await getItemForFamily(input.itemId, ctx.familySession.familyId);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos ese artículo." });
    return setItemStatus({ familyId: ctx.familySession.familyId, itemId: input.itemId, status: "archived", actorName: ctx.familySession.memberName, reason: input.reason });
  }),

  restore: familyProcedure.input(z.object({ itemId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const item = await getItemForFamily(input.itemId, ctx.familySession.familyId);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos ese artículo." });
    return setItemStatus({ familyId: ctx.familySession.familyId, itemId: input.itemId, status: "pending", actorName: ctx.familySession.memberName });
  }),
});
