import {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";

export interface AuthContext {
  userId: string;
  orgId: string;
  orgRole: string;
}

/**
 * Extract and validate auth context from a Convex function context.
 * Every public query/mutation/action should call this at the top.
 *
 * Returns the Clerk user ID, active org ID, and org role from the JWT.
 * Throws if the user is not authenticated or has no active org.
 */
export async function getAuthContext(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<AuthContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: no valid session");
  }

  // Clerk includes org info in custom JWT claims
  // These come from the Clerk JWT template configured for Convex
  const orgId = (identity as Record<string, unknown>).org_id as
    | string
    | undefined;
  const orgRole = (identity as Record<string, unknown>).org_role as
    | string
    | undefined;

  if (!orgId) {
    throw new Error(
      "No active organization selected. Please select an organization to continue.",
    );
  }

  return {
    userId: identity.subject,
    orgId,
    orgRole: orgRole ?? "org:member",
  };
}
