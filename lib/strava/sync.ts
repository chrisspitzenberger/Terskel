import { db } from "@/lib/db";
import { activities } from "@/lib/db/drizzle-schema";
import { getValidStravaToken, getUserIdByStravaAthleteId } from "./token";
import {
  fetchStravaActivity,
  fetchStravaActivityStreams,
  fetchStravaAthleteActivities,
  StravaApiError,
} from "./api";
import type { StravaDetailedActivity, StravaStreamSet } from "./types";

// =============================================================================
// Strava Activity Sync Service
// =============================================================================

/**
 * Sync a single Strava activity triggered by a webhook event.
 *
 * @param stravaAthleteId - The Strava athlete ID (from webhook `owner_id`)
 * @param stravaActivityId - The Strava activity ID (from webhook `object_id`)
 */
export async function syncStravaActivity(
  stravaAthleteId: number,
  stravaActivityId: number
): Promise<void> {
  // 1. Resolve internal user ID from Strava athlete ID
  const userId = await getUserIdByStravaAthleteId(stravaAthleteId);
  if (!userId) {
    console.warn(
      `[Strava Sync] No user found for Strava athlete ${stravaAthleteId}`
    );
    return;
  }

  // 2. Get a valid access token
  const accessToken = await getValidStravaToken(userId);
  if (!accessToken) {
    console.error(
      `[Strava Sync] Could not get valid token for user ${userId}`
    );
    return;
  }

  try {
    // 3. Fetch detailed activity from Strava
    const activity = await fetchStravaActivity(
      accessToken,
      String(stravaActivityId)
    );

    // 4. Fetch streams (HR, pace, cadence, etc.)
    let streams: StravaStreamSet = {};
    try {
      streams = await fetchStravaActivityStreams(
        accessToken,
        String(stravaActivityId)
      );
    } catch (err) {
      // Streams are optional — log but don't fail
      console.warn(
        `[Strava Sync] Could not fetch streams for activity ${stravaActivityId}:`,
        err instanceof Error ? err.message : err
      );
    }

    // 5. Upsert into database
    await upsertActivity(userId, activity, streams);

    console.log(
      `[Strava Sync] Successfully synced activity ${stravaActivityId} (${activity.name}) for user ${userId}`
    );
  } catch (err) {
    if (err instanceof StravaApiError) {
      if (err.isRateLimited) {
        console.error(
          `[Strava Sync] Rate limited — will retry on next webhook`
        );
        return;
      }
      if (err.isNotFound) {
        console.warn(
          `[Strava Sync] Activity ${stravaActivityId} not found (possibly deleted)`
        );
        return;
      }
    }
    console.error(`[Strava Sync] Error syncing activity ${stravaActivityId}:`, err);
    throw err;
  }
}

/**
 * Bulk sync all historical activities for a user.
 * Fetches all activities from Strava and upserts them.
 *
 * @param userId - The internal user ID
 * @param after - Optional Unix timestamp to only sync activities after this date
 */
export async function syncAllStravaActivities(
  userId: string,
  after?: number
): Promise<{ synced: number; errors: number }> {
  const accessToken = await getValidStravaToken(userId);
  if (!accessToken) {
    throw new Error(`Could not get valid Strava token for user ${userId}`);
  }

  let page = 1;
  let synced = 0;
  let errors = 0;
  const perPage = 50; // Strava max is 200, but smaller pages are safer

  console.log(
    `[Strava Sync] Starting bulk sync for user ${userId}${after ? ` (after ${new Date(after * 1000).toISOString()})` : ""}`
  );

  while (true) {
    // Fetch a page of summary activities
    const summaryActivities = await fetchStravaAthleteActivities(accessToken, {
      page,
      perPage,
      after,
    });

    if (summaryActivities.length === 0) {
      break; // No more activities
    }

    // For each summary, fetch the detailed activity + streams
    for (const summary of summaryActivities) {
      try {
        const [detail, streams] = await Promise.all([
          fetchStravaActivity(accessToken, String(summary.id)),
          fetchStravaActivityStreams(accessToken, String(summary.id)).catch(
            () => ({}) as StravaStreamSet
          ),
        ]);

        await upsertActivity(userId, detail, streams);
        synced++;
        console.log(
          `[Strava Sync] Synced ${synced}: "${detail.name}" (${detail.start_date})`
        );

        // Small delay to respect Strava rate limits (100 requests per 15 min)
        await sleep(600);
      } catch (err) {
        errors++;
        console.error(
          `[Strava Sync] Error syncing activity ${summary.id}:`,
          err instanceof Error ? err.message : err
        );

        if (err instanceof StravaApiError && err.isRateLimited) {
          console.warn(
            "[Strava Sync] Rate limited — stopping bulk sync. Resume later."
          );
          return { synced, errors };
        }
      }
    }

    page++;
  }

  console.log(
    `[Strava Sync] Bulk sync complete: ${synced} synced, ${errors} errors`
  );
  return { synced, errors };
}

// =============================================================================
// Database Upsert
// =============================================================================

/**
 * Insert or update a Strava activity in the database.
 * Uses the `external_strava_id` UNIQUE constraint for conflict detection.
 */
async function upsertActivity(
  userId: string,
  activity: StravaDetailedActivity,
  streams: StravaStreamSet
): Promise<void> {
  const activityData = mapStravaToDb(userId, activity, streams);

  await db
    .insert(activities)
    .values(activityData)
    .onConflictDoUpdate({
      target: activities.externalStravaId,
      set: {
        // Update all fields except id, userId, externalStravaId, createdAt
        name: activityData.name,
        description: activityData.description,
        type: activityData.type,
        sportType: activityData.sportType,
        workoutType: activityData.workoutType,
        distance: activityData.distance,
        movingTime: activityData.movingTime,
        elapsedTime: activityData.elapsedTime,
        totalElevationGain: activityData.totalElevationGain,
        averageSpeed: activityData.averageSpeed,
        maxSpeed: activityData.maxSpeed,
        averageHeartrate: activityData.averageHeartrate,
        maxHeartrate: activityData.maxHeartrate,
        averageCadence: activityData.averageCadence,
        averageWatts: activityData.averageWatts,
        maxWatts: activityData.maxWatts,
        weightedAverageWatts: activityData.weightedAverageWatts,
        kilojoules: activityData.kilojoules,
        calories: activityData.calories,
        deviceWatts: activityData.deviceWatts,
        hasHeartrate: activityData.hasHeartrate,
        elevHigh: activityData.elevHigh,
        elevLow: activityData.elevLow,
        averageTemp: activityData.averageTemp,
        timezone: activityData.timezone,
        startDate: activityData.startDate,
        startDateLocal: activityData.startDateLocal,
        polyline: activityData.polyline,
        summaryPolyline: activityData.summaryPolyline,
        startLatlng: activityData.startLatlng,
        endLatlng: activityData.endLatlng,
        prCount: activityData.prCount,
        sufferScore: activityData.sufferScore,
        achievementCount: activityData.achievementCount,
        gearId: activityData.gearId,
        deviceName: activityData.deviceName,
        trainer: activityData.trainer,
        commute: activityData.commute,
        manual: activityData.manual,
        private: activityData.private,
        flagged: activityData.flagged,
        splitsMetric: activityData.splitsMetric,
        stravaLaps: activityData.stravaLaps,
        bestEfforts: activityData.bestEfforts,
        segmentEfforts: activityData.segmentEfforts,
        heartrateStream: activityData.heartrateStream,
        cadenceStream: activityData.cadenceStream,
        wattsStream: activityData.wattsStream,
        velocityStream: activityData.velocityStream,
        altitudeStream: activityData.altitudeStream,
        distanceStream: activityData.distanceStream,
        timeStream: activityData.timeStream,
        latlngStream: activityData.latlngStream,
        gradeStream: activityData.gradeStream,
        tempStream: activityData.tempStream,
        updatedAt: new Date(),
      },
    });
}

// =============================================================================
// Data Mapping
// =============================================================================

/**
 * Map a Strava DetailedActivity + StreamSet to our DB schema format.
 */
function mapStravaToDb(
  userId: string,
  activity: StravaDetailedActivity,
  streams: StravaStreamSet
) {
  return {
    userId,
    externalStravaId: String(activity.id),
    name: activity.name,
    description: activity.description,
    type: activity.type,
    sportType: activity.sport_type,
    workoutType: activity.workout_type,
    distance: activity.distance,
    movingTime: activity.moving_time,
    elapsedTime: activity.elapsed_time,
    totalElevationGain: activity.total_elevation_gain,
    averageSpeed: activity.average_speed,
    maxSpeed: activity.max_speed,
    averageHeartrate: activity.average_heartrate ?? null,
    maxHeartrate: activity.max_heartrate ?? null,
    averageCadence: activity.average_cadence ?? null,
    averageWatts: activity.average_watts ?? null,
    maxWatts: activity.max_watts ?? null,
    weightedAverageWatts: activity.weighted_average_watts ?? null,
    kilojoules: activity.kilojoules ?? null,
    calories: activity.calories,
    deviceWatts: activity.device_watts ?? null,
    hasHeartrate: activity.has_heartrate,
    elevHigh: activity.elev_high ?? null,
    elevLow: activity.elev_low ?? null,
    averageTemp: activity.average_temp ?? null,
    timezone: activity.timezone,
    startDate: new Date(activity.start_date),
    startDateLocal: new Date(activity.start_date_local),
    polyline: activity.map?.polyline ?? null,
    summaryPolyline: activity.map?.summary_polyline ?? null,
    startLatlng: activity.start_latlng,
    endLatlng: activity.end_latlng,
    prCount: activity.pr_count,
    sufferScore: activity.suffer_score ?? null,
    achievementCount: activity.achievement_count,
    gearId: activity.gear_id,
    deviceName: activity.device_name,
    trainer: activity.trainer,
    commute: activity.commute,
    manual: activity.manual,
    private: activity.private,
    flagged: activity.flagged,
    // Complex nested data
    splitsMetric: activity.splits_metric ?? null,
    stravaLaps: activity.laps ?? null,
    bestEfforts: activity.best_efforts ?? null,
    segmentEfforts: activity.segment_efforts ?? null,
    // Streams — store only the data arrays for compact storage
    heartrateStream: streams.heartrate?.data ?? null,
    cadenceStream: streams.cadence?.data ?? null,
    wattsStream: streams.watts?.data ?? null,
    velocityStream: streams.velocity_smooth?.data ?? null,
    altitudeStream: streams.altitude?.data ?? null,
    distanceStream: streams.distance?.data ?? null,
    timeStream: streams.time?.data ?? null,
    latlngStream: streams.latlng?.data ?? null,
    gradeStream: streams.grade_smooth?.data ?? null,
    tempStream: streams.temp?.data ?? null,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
