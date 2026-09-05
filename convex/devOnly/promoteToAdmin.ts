// =============================================================================
// mi-dorsal — Dev/admin: promoteToAdmin
// =============================================================================
// PROMOTE A USER A ADMIN. Solo usar para bootstrapping (no tiene auth check).
// Usar con `npx convex run --deployment precious-goshawk-41
// 'devOnly/promoteToAdmin:promoteToAdmin' '{"email":"manuvera08@gmail.com"}'`
// =============================================================================

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const promoteToAdmin = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx: any, { email }) => {
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("email"), email))
      .first();
    if (!profile) {
      throw new Error(`No profile found for email: ${email}`);
    }
    await ctx.db.patch(profile._id, { role: "admin" });
    return {
      success: true,
      profileId: profile._id,
      email: profile.email,
      displayName: profile.displayName,
    };
  },
});
