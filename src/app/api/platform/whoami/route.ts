import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userRoles, users } from "@/db/schema";
import { requireRole, toAuthErrorResponse } from "@/lib/auth";

/**
 * Proving slice for the P2 platform layer: verify a token, enforce a role, then read the
 * database. Every later migrated endpoint is this shape.
 *
 * Restricted to INFLUENCER purely to exercise `requireRole` — a BRAND token gets a real 403 here,
 * which is the behaviour Spring cannot currently produce on any endpoint.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireRole(request, "INFLUENCER");

    const [row] = await db
      .select({
        userId: users.userId,
        email: users.email,
        activeRole: users.activeRole,
      })
      .from(users)
      .where(eq(users.userId, BigInt(claims.userId)))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { status: "ERROR", data: null, error: "not_found", message: "No such user." },
        { status: 404 },
      );
    }

    const held = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, claims.userId));

    return NextResponse.json({
      status: "SUCCESS",
      data: {
        token: { userId: claims.userId, roles: claims.roles, activeRole: claims.activeRole },
        database: {
          userId: Number(row.userId),
          email: row.email,
          activeRole: row.activeRole,
          rolesHeld: held.map((r) => r.role),
        },
        /**
         * The token's activeRole and the database's can disagree, because `switchRole` updates
         * the row without issuing a new token. Surfacing it makes that drift observable.
         */
        activeRoleMatchesDatabase: claims.activeRole === row.activeRole,
      },
    });
  } catch (error) {
    const response = toAuthErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
