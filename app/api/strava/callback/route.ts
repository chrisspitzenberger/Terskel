import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/drizzle-schema";
import { eq, and } from "drizzle-orm";
import type { StravaTokenResponse } from "@/lib/strava/types";

/**
 * Strava OAuth token response includes athlete info
 */
interface StravaOAuthResponse extends StravaTokenResponse {
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
    profile_medium: string;
  };
}

/**
 * GET /api/strava/callback
 *
 * Handles the OAuth callback from Strava after the user authorizes.
 * Exchanges the authorization code for tokens and stores them in the
 * `account` table, linked to the current user.
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/login?error=NotAuthenticated", request.url)
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied access
  if (error) {
    console.warn("[Strava] OAuth denied:", error);
    return NextResponse.redirect(
      new URL("/settings/profile?strava=denied", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings/profile?strava=error", request.url)
    );
  }

  // Verify state matches the logged-in user
  if (state !== session.user.id) {
    console.error("[Strava] State mismatch in OAuth callback");
    return NextResponse.redirect(
      new URL("/settings/profile?strava=error", request.url)
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[Strava] Token exchange failed: ${errorText}`);
      return NextResponse.redirect(
        new URL("/settings/profile?strava=error", request.url)
      );
    }

    const data: StravaOAuthResponse = await tokenResponse.json();

    // Check if this Strava account is already linked to another user
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, "strava"),
          eq(accounts.providerAccountId, String(data.athlete.id))
        )
      )
      .then((res) => res[0]);

    if (existingAccount && existingAccount.userId !== session.user.id) {
      console.error(
        `[Strava] Athlete ${data.athlete.id} already linked to user ${existingAccount.userId}`
      );
      return NextResponse.redirect(
        new URL("/settings/profile?strava=already_linked", request.url)
      );
    }

    if (existingAccount) {
      // Update existing link (same user reconnecting)
      await db
        .update(accounts)
        .set({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          token_type: data.token_type,
          scope: "read,activity:read_all",
        })
        .where(
          and(
            eq(accounts.provider, "strava"),
            eq(accounts.providerAccountId, String(data.athlete.id))
          )
        );
    } else {
      // Insert new account link
      await db.insert(accounts).values({
        userId: session.user.id,
        type: "oauth",
        provider: "strava",
        providerAccountId: String(data.athlete.id),
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        token_type: data.token_type,
        scope: "read,activity:read_all",
      });
    }

    console.log(
      `[Strava] Account linked: athlete ${data.athlete.id} → user ${session.user.id}`
    );

    return NextResponse.redirect(
      new URL("/settings/profile?strava=connected", request.url)
    );
  } catch (err) {
    console.error("[Strava] OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/settings/profile?strava=error", request.url)
    );
  }
}
