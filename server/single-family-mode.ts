import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { findFamilyById, findFamilyByInviteCode } from "./family-repository";

export function isSingleFamilyMode() {
  return ENV.singleFamilyMode;
}

export async function getConfiguredSingleFamily() {
  if (!isSingleFamilyMode()) return null;

  const family = ENV.singleFamilyId
    ? await findFamilyById(ENV.singleFamilyId)
    : ENV.singleFamilyInviteCode
      ? await findFamilyByInviteCode(ENV.singleFamilyInviteCode.trim().toUpperCase())
      : null;

  if (!family) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "La familia única no está configurada o no existe.",
    });
  }

  return family;
}

export async function assertSingleFamilySession(familyId: string) {
  const family = await getConfiguredSingleFamily();
  if (!family) return;

  if (family.id !== familyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Esta sesión no pertenece a la familia configurada.",
    });
  }
}
