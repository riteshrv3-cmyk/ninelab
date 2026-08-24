import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, studentsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { formatStudent } from "./students";

const router = Router();

// POST /auth/claim — link the signed-in Clerk account to a student row.
// Idempotent: safe to call every time the app loads for a signed-in user.
router.post("/auth/claim", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in required" });
  }

  const { studentId, guestToken } = req.body as { studentId?: number; guestToken?: string };

  try {
    const [alreadyClaimed] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.clerkUserId, userId))
      .limit(1);
    if (alreadyClaimed) {
      return res.status(200).json({ student: formatStudent(alreadyClaimed), claimed: false, created: false });
    }

    if (studentId && guestToken) {
      const [guestRow] = await db
        .select()
        .from(studentsTable)
        .where(
          and(
            eq(studentsTable.id, Number(studentId)),
            eq(studentsTable.guestToken, guestToken),
            isNull(studentsTable.clerkUserId),
          ),
        )
        .limit(1);

      if (guestRow) {
        const clerkUser = await clerkClient.users.getUser(userId);
        const primaryEmail =
          clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          guestRow.email;

        const [adopted] = await db
          .update(studentsTable)
          .set({
            clerkUserId: userId,
            guestToken: null,
            email: primaryEmail,
          })
          .where(eq(studentsTable.id, guestRow.id))
          .returning();

        return res.status(200).json({ student: formatStudent(adopted), claimed: true, created: false });
      }
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    const primaryEmail =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      `${userId}@clerk.ninelab.internal`;
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Student";

    // Legacy row with this real email but no clerkUserId (pre-dates guest-email scheme) — claim it instead of erroring.
    const [existingByEmail] = await db
      .select()
      .from(studentsTable)
      .where(and(eq(studentsTable.email, primaryEmail), isNull(studentsTable.clerkUserId)))
      .limit(1);
    if (existingByEmail) {
      const [adopted] = await db
        .update(studentsTable)
        .set({ clerkUserId: userId, guestToken: null })
        .where(eq(studentsTable.id, existingByEmail.id))
        .returning();
      return res.status(200).json({ student: formatStudent(adopted), claimed: true, created: false });
    }

    const [created] = await db
      .insert(studentsTable)
      .values({
        name,
        email: primaryEmail,
        college: "Not set",
        city: "Not set",
        year: 1,
        field: "Not set",
        clerkUserId: userId,
        overallScore: 0,
        xp: 0,
        level: 1,
        streakCount: 0,
        lastActiveDate: new Date().toISOString().split("T")[0],
        skills: {},
        isPro: false,
      })
      .returning();

    return res.status(201).json({ student: formatStudent(created), claimed: false, created: true });
  } catch (err) {
    req.log.error({ err }, "Failed to claim student");
    return res.status(500).json({ error: "Failed to claim student" });
  }
});

export default router;
