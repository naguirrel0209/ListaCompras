import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clearFamilySession, getFamilySession, writeFamilySession } from "../family-session";
import { hashSharedPassword, verifySharedPassword } from "../family-security";
import { createFamily, findFamilyById, findFamilyByInviteCode, inviteCodeExists, recordActivity } from "../family-repository";
import { getConfiguredSingleFamily } from "../single-family-mode";
import { familyProcedure, publicProcedure, router } from "../_core/trpc";

const name = z.string().trim().min(2, "Escribe al menos 2 caracteres.").max(80, "No puede superar 80 caracteres.");
const password = z.string().min(4, "La contraseña debe tener al menos 4 caracteres.").max(128, "La contraseña es demasiado larga.");

async function generateInviteCode() {
  const words = ["CASA", "MESA", "LUNA", "NIDO", "HOGAR", "SOL", "VIVA", "MIMO"];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const word = words[Math.floor(Math.random() * words.length)];
    const code = `${word}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await inviteCodeExists(code))) return code;
  }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No fue posible crear un código único. Inténtalo de nuevo." });
}

function publicFamily(family: { id: string; name: string; inviteCode: string; passwordHash: string | null; createdAt: Date }) {
  return { id: family.id, name: family.name, inviteCode: family.inviteCode, hasPassword: Boolean(family.passwordHash), createdAt: family.createdAt };
}

export const familyRouter = router({
  singleAccess: publicProcedure.input(z.object({
    memberName: name,
  })).mutation(async ({ ctx, input }) => {
    const family = await getConfiguredSingleFamily();
    if (!family) throw new TRPCError({ code: "NOT_FOUND", message: "La familia única no está activa." });

    await writeFamilySession(ctx.req, ctx.res, { familyId: family.id, memberName: input.memberName });
    await recordActivity({
      familyId: family.id,
      listId: null,
      itemId: null,
      action: "miembro_ingreso",
      actorName: input.memberName,
      description: "Ingresó a la lista familiar.",
    });

    return { family: publicFamily(family), memberName: input.memberName };
  }),

  create: publicProcedure.input(z.object({
    familyName: name,
    memberName: name,
    password: password.optional().or(z.literal("")),
    initialListName: name.optional(),
  })).mutation(async ({ ctx, input }) => {
    const normalizedPassword = input.password?.trim() || undefined;
    const { family, firstList } = await createFamily({
      name: input.familyName,
      passwordHash: normalizedPassword ? await hashSharedPassword(normalizedPassword) : null,
      createdBy: input.memberName,
      inviteCode: await generateInviteCode(),
      initialListName: input.initialListName ?? "Compra semanal",
    });
    await writeFamilySession(ctx.req, ctx.res, { familyId: family.id, memberName: input.memberName });
    return { family: publicFamily(family), firstList, memberName: input.memberName };
  }),

  join: publicProcedure.input(z.object({
    inviteCode: z.string().trim().toUpperCase().regex(/^[A-Z]+-\d{4}$/, "El código debe tener el formato CASA-1234."),
    password: z.string().max(128).optional(),
    memberName: name,
  })).mutation(async ({ ctx, input }) => {
    const family = await findFamilyByInviteCode(input.inviteCode);
    if (!family) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos una familia con ese código." });
    if (family.passwordHash && !(input.password && await verifySharedPassword(input.password, family.passwordHash))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "La contraseña no es correcta." });
    }
    await writeFamilySession(ctx.req, ctx.res, { familyId: family.id, memberName: input.memberName });
    await recordActivity({
      familyId: family.id,
      listId: null,
      itemId: null,
      action: "miembro_ingreso",
      actorName: input.memberName,
      description: `Ingresó a la lista familiar.`,
    });
    return { family: publicFamily(family), memberName: input.memberName };
  }),

  current: publicProcedure.query(async ({ ctx }) => {
    const singleFamily = await getConfiguredSingleFamily();
    const familySession = await getFamilySession(ctx.req);
    if (!familySession) return null;

    if (singleFamily && familySession.familyId !== singleFamily.id) {
      clearFamilySession(ctx.req, ctx.res);
      return null;
    }

    const family = singleFamily ?? await findFamilyById(familySession.familyId);
    if (!family) {
      clearFamilySession(ctx.req, ctx.res);
      return null;
    }
    return { family: publicFamily(family), memberName: familySession.memberName };
  }),

  logout: familyProcedure.mutation(({ ctx }) => {
    clearFamilySession(ctx.req, ctx.res);
    return { success: true } as const;
  }),
});
