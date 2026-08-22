import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createShoppingList, getFamilyLists, getListForFamily, removeShoppingList, renameShoppingList } from "../family-repository";
import { familyProcedure, router } from "../_core/trpc";

const listName = z.string().trim().min(2, "Escribe al menos 2 caracteres.").max(80, "El nombre es demasiado largo.");

export const listsRouter = router({
  all: familyProcedure.query(({ ctx }) => getFamilyLists(ctx.familySession.familyId)),
  create: familyProcedure.input(z.object({ name: listName })).mutation(({ ctx, input }) =>
    createShoppingList({ familyId: ctx.familySession.familyId, name: input.name, createdBy: ctx.familySession.memberName }),
  ),
  rename: familyProcedure.input(z.object({ listId: z.string().min(1), name: listName })).mutation(async ({ ctx, input }) => {
    const list = await getListForFamily(input.listId, ctx.familySession.familyId);
    if (!list) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos esa lista." });
    return renameShoppingList({ familyId: ctx.familySession.familyId, listId: input.listId, name: input.name, actorName: ctx.familySession.memberName });
  }),
  remove: familyProcedure.input(z.object({ listId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const list = await removeShoppingList({ familyId: ctx.familySession.familyId, listId: input.listId, actorName: ctx.familySession.memberName });
    if (!list) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos esa lista." });
    return { success: true, listName: list.name } as const;
  }),
});
