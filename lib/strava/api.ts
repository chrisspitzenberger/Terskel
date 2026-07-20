import type {
  StravaDetailedActivity,
  StravaStreamSet,
  StravaSummaryActivity,
} from "./types";

// =============================================================================
// Strava API Client
// =============================================================================

const STRAVA_API_BASE = "https://www.strava.com/api/v3";

/**
 * Fetch a detailed activity from the Strava API.
 */
export async function fetchStravaActivity(
  accessToken: string,
  activityId: string
): Promise<StravaDetailedActivity> {
  const response = await fetch(
    `${STRAVA_API_BASE}/activities/${activityId}?include_all_efforts=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new StravaApiError(
      `Failed to fetch activity ${activityId}`,
      response.status,
      errorText
    );
  }

  return response.json();
}

/**
 * Fetch activity streams (time-series data: HR, pace, power, etc.)
 * from the Strava API.
 */
export async function fetchStravaActivityStreams(
  accessToken: string,
  activityId: string
): Promise<StravaStreamSet> {
  const streamKeys = [
    "time",
    "distance",
    "latlng",
    "altitude",
    "velocity_smooth",
    "heartrate",
    "cadence",
    "watts",
    "temp",
    "grade_smooth",
  ].join(",");

  const response = await fetch(
    `${STRAVA_API_BASE}/activities/${activityId}/streams?keys=${streamKeys}&key_by_type=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    // Streams might not be available for manual activities — that's OK
    if (response.status === 404) {
      console.warn(
        `[Strava] No streams available for activity ${activityId}`
      );
      return {};
    }
    const errorText = await response.text();
    throw new StravaApiError(
      `Failed to fetch streams for activity ${activityId}`,
      response.status,
      errorText
    );
  }

  return response.json();
}

/**
 * Fetch a list of athlete activities (for historical/bulk sync).
 *
 * @param page - Page number (1-indexed)
 * @param perPage - Items per page (max 200)
 * @param after - Unix timestamp — only activities after this time
 * @param before - Unix timestamp — only activities before this time
 */
export async function fetchStravaAthleteActivities(
  accessToken: string,
  options: {
    page?: number;
    perPage?: number;
    after?: number;
    before?: number;
  } = {}
): Promise<StravaSummaryActivity[]> {
  const { page = 1, perPage = 50, after, before } = options;

  const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  if (after) url.searchParams.set("after", String(after));
  if (before) url.searchParams.set("before", String(before));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new StravaApiError(
      "Failed to fetch athlete activities",
      response.status,
      errorText
    );
  }

  return response.json();
}

// =============================================================================
// Error Types
// =============================================================================

export class StravaApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message);
    this.name = "StravaApiError";
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }
}
