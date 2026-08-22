import { z } from "zod";
import { getActivitiesForFamily } from "../family-repository";
import { familyProcedure, router } from "../_core/trpc";

export const activitiesRouter = router({
  recent: familyProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(16) }).optional()).query(({ ctx, input }) =>
    getActivitiesForFamily(ctx.familySession.familyId, input?.limit ?? 16),
  ),
});
