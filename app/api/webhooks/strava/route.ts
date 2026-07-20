import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { syncStravaActivity } from "@/lib/strava/sync";
import type { StravaWebhookEvent } from "@/lib/strava/types";

// =============================================================================
// Strava Webhook Endpoint
// =============================================================================

/**
 * GET /api/webhooks/strava
 *
 * Handles Strava webhook subscription verification.
 * Strava sends a GET request with hub.mode, hub.challenge, hub.verify_token
 * and expects a JSON response with hub.challenge.
 *
 * @see https://developers.strava.com/docs/webhooks/
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = searchParams.get("hub.verify_token");

  const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && verifyToken === expectedToken && challenge) {
    console.log("[Strava Webhook] Subscription verified successfully");
    return NextResponse.json({ "hub.challenge": challenge });
  }

  console.warn("[Strava Webhook] Verification failed", {
    mode,
    verifyToken,
    expectedToken: expectedToken ? "***" : "NOT SET",
    hasChallenge: !!challenge,
  });

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * POST /api/webhooks/strava
 *
 * Receives event notifications from Strava when activities are
 * created, updated, or deleted.
 *
 * IMPORTANT: Must respond with 200 immediately. Actual processing
 * happens asynchronously via Next.js `after()` to avoid timeouts.
 */
export async function POST(request: NextRequest) {
  let event: StravaWebhookEvent;

  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[Strava Webhook] Received event:", {
    object_type: event.object_type,
    object_id: event.object_id,
    aspect_type: event.aspect_type,
    owner_id: event.owner_id,
  });

  // Only process activity events (not athlete profile updates)
  if (event.object_type === "activity") {
    if (event.aspect_type === "create" || event.aspect_type === "update") {
      // Use Next.js after() to process asynchronously AFTER the response is sent
      after(async () => {
        try {
          await syncStravaActivity(event.owner_id, event.object_id);
        } catch (err) {
          console.error(
            "[Strava Webhook] Async processing error:",
            err instanceof Error ? err.message : err
          );
        }
      });
    }

    if (event.aspect_type === "delete") {
      // Optionally handle deletions — for now just log
      console.log(
        `[Strava Webhook] Activity ${event.object_id} deleted by athlete ${event.owner_id}`
      );
      // TODO: Optionally delete from DB
    }
  }

  // ALWAYS respond immediately with 200 OK
  return NextResponse.json({ status: "ok" });
}
