import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * GET /api/strava/connect
 *
 * Initiates the Strava OAuth flow for account linking.
 * The user must already be logged in. Redirects to Strava's
 * authorization page with the appropriate scopes.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be logged in to connect Strava." },
      { status: 401 }
    );
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Strava is not configured." },
      { status: 500 }
    );
  }

  // Build the redirect URL back to our callback
  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const redirectUri = `${baseUrl}/api/strava/callback`;

  // Use the user's ID as state to verify the callback
  // In production you'd use a signed/encrypted state token
  const state = session.user.id;

  const stravaAuthUrl = new URL("https://www.strava.com/oauth/authorize");
  stravaAuthUrl.searchParams.set("client_id", clientId);
  stravaAuthUrl.searchParams.set("redirect_uri", redirectUri);
  stravaAuthUrl.searchParams.set("response_type", "code");
  stravaAuthUrl.searchParams.set("scope", "read,activity:read_all");
  stravaAuthUrl.searchParams.set("state", state);
  stravaAuthUrl.searchParams.set("approval_prompt", "auto");

  return NextResponse.redirect(stravaAuthUrl.toString());
}
