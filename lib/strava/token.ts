import { db } from "@/lib/db";
import { accounts } from "@/lib/db/drizzle-schema";
import { eq, and } from "drizzle-orm";
import type { StravaTokenResponse } from "./types";

// =============================================================================
// Strava Token Management
// =============================================================================

/**
 * Get a valid Strava access token for a given user.
 * If the token is expired, it will be refreshed automatically.
 *
 * @param userId - The internal user ID (from the `user` table)
 * @returns The valid access token string, or null if no Strava account is linked
 */
export async function getValidStravaToken(
  userId: string
): Promise<string | null> {
  // Find the Strava account entry for this user
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "strava")))
    .then((res) => res[0]);

  if (!account) {
    console.warn(`[Strava] No Strava account linked for user ${userId}`);
    return null;
  }

  if (!account.access_token || !account.refresh_token) {
    console.error(`[Strava] Missing tokens for user ${userId}`);
    return null;
  }

  // Check if token is expired (expires_at is a Unix timestamp in seconds)
  const now = Math.floor(Date.now() / 1000);
  const isExpired = !account.expires_at || account.expires_at < now;

  if (!isExpired) {
    return account.access_token;
  }

  // Token is expired — refresh it
  console.log(`[Strava] Token expired for user ${userId}, refreshing...`);
  return refreshStravaToken(account.userId, account.refresh_token);
}

/**
 * Refresh a Strava access token using the refresh token.
 * Updates the account record in the database with the new tokens.
 */
async function refreshStravaToken(
  userId: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Strava] Token refresh failed (${response.status}): ${errorText}`
      );
      return null;
    }

    const data: StravaTokenResponse = await response.json();

    // Update the account record with new tokens
    await db
      .update(accounts)
      .set({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        token_type: data.token_type,
      })
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, "strava")));

    console.log(`[Strava] Token refreshed successfully for user ${userId}`);
    return data.access_token;
  } catch (error) {
    console.error("[Strava] Token refresh error:", error);
    return null;
  }
}

/**
 * Find the internal user ID by Strava athlete ID.
 * Used by the webhook handler to map owner_id → userId.
 *
 * @param stravaAthleteId - The Strava athlete ID (number from webhook)
 * @returns The internal user ID, or null if not found
 */
export async function getUserIdByStravaAthleteId(
  stravaAthleteId: number
): Promise<string | null> {
  const account = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, "strava"),
        eq(accounts.providerAccountId, String(stravaAthleteId))
      )
    )
    .then((res) => res[0]);

  return account?.userId ?? null;
}
