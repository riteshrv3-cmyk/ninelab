import type { Request, Response, NextFunction, RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, collegeAdminsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

export interface CollegeAdminContext {
  id: number;
  collegeId: number;
  email: string;
}

export interface CollegeAdminRequest extends Request {
  collegeAdmin?: CollegeAdminContext;
}

/**
 * Resolve the signed-in Clerk user to a college_admins row, or null if they are
 * not on the allowlist. Fast path: clerkUserId already bound. Slow path: match
 * the Clerk primary email (lowercased) against an unbound allowlist row and bind
 * clerkUserId once. Returns null (never throws for "not an admin") so /me/role
 * can use it too.
 */
export async function resolveCollegeAdmin(req: Request): Promise<CollegeAdminContext | null> {
  const { userId } = getAuth(req);
  if (!userId) return null;

  const [byClerk] = await db
    .select()
    .from(collegeAdminsTable)
    .where(eq(collegeAdminsTable.clerkUserId, userId))
    .limit(1);
  if (byClerk) return { id: byClerk.id, collegeId: byClerk.collegeId, email: byClerk.email };

  const clerkUser = await clerkClient.users.getUser(userId);
  const email = (
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    ""
  ).toLowerCase().trim();
  if (!email) return null;

  const [byEmail] = await db
    .select()
    .from(collegeAdminsTable)
    .where(and(eq(collegeAdminsTable.email, email), isNull(collegeAdminsTable.clerkUserId)))
    .limit(1);
  if (!byEmail) return null;

  const [bound] = await db
    .update(collegeAdminsTable)
    .set({ clerkUserId: userId, lastSeenAt: new Date() })
    .where(eq(collegeAdminsTable.id, byEmail.id))
    .returning();
  return { id: bound.id, collegeId: bound.collegeId, email: bound.email };
}

/**
 * Gate for /college-admin/* routes. Must be path-scoped by the mounting router
 * (router.use("/college-admin", requireCollegeAdmin())) — every feature router
 * shares the same /api root, so an unscoped use would gate unrelated routers.
 */
export function requireCollegeAdmin(): RequestHandler {
  return async (req: CollegeAdminRequest, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolveCollegeAdmin(req);
      if (!ctx) {
        res.status(403).json({ error: "College admin access required" });
        return;
      }
      req.collegeAdmin = ctx;
      // Best-effort activity signal; never blocks the request.
      db.update(collegeAdminsTable).set({ lastSeenAt: new Date() }).where(eq(collegeAdminsTable.id, ctx.id)).catch(() => {});
      next();
    } catch (err) {
      req.log.error({ err }, "college admin auth failed");
      res.status(500).json({ error: "Auth error" });
    }
  };
}
