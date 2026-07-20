import { pgTable, text, timestamp, integer, boolean, real, jsonb, pgEnum, primaryKey, doublePrecision, uniqueIndex } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const lapTypeEnum = pgEnum('lap_type', ['effort', 'rest']);
export const trainingTypeEnum = pgEnum('training_type', ['interval', 'long_run', 'tempo', 'step_test', 'easy', 'race']);
export const environmentEnum = pgEnum('environment', ['track', 'treadmill', 'road', 'trail']);
export const stepTestStatusEnum = pgEnum('step_test_status', ['setup', 'in_progress', 'completed', 'cancelled']);
export const stepTestModeEnum = pgEnum('step_test_mode', ['manual', 'smart']);

export const trainings = pgTable("trainings", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp("date").notNull(),
  title: text("title").notNull(),
  type: trainingTypeEnum("type").notNull(),
  environment: environmentEnum("environment"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const laps = pgTable("laps", {
  id: text("id").primaryKey(),
  trainingId: text("training_id").references(() => trainings.id, { onDelete: 'cascade' }).notNull(),
  type: lapTypeEnum("type").notNull(),
  distanceM: integer("distance_m").notNull(),
  durationS: integer("duration_s").notNull(),
  paceMinKm: real("pace_min_km"),
  avgHr: integer("avg_hr"),
  maxHr: integer("max_hr"),
  lactateMmol: real("lactate_mmol"),
  linkedEffortId: text("linked_effort_id"),
  notes: text("notes"),
});

export const stepTests = pgTable("step_tests", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp("date").notNull(),
  title: text("title").notNull(),
  status: stepTestStatusEnum("status").notNull(),
  protocol: jsonb("protocol").notNull(), // Stores mode, environment, etc.
  results: jsonb("results"),             // Stores lt1_pace, lt2_pace, zones, etc.
  restingLactate: real("resting_lactate"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stepTestSteps = pgTable("step_test_steps", {
  id: text("id").primaryKey(), // Could also use serial
  stepTestId: text("step_test_id").references(() => stepTests.id, { onDelete: 'cascade' }).notNull(),
  stepNumber: integer("step_number").notNull(),
  targetPaceMinKm: real("target_pace_min_km").notNull(),
  actualPaceMinKm: real("actual_pace_min_km"),
  endHr: integer("end_hr"),
  lactateMmol: real("lactate_mmol"),
  completed: boolean("completed").default(false).notNull(),
  skipped: boolean("skipped").default(false),
});

// =============================================================================
// Strava Activities
// =============================================================================

export const activities = pgTable("activities", {
  // --- Identity ---
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  externalStravaId: text("external_strava_id").notNull(),

  // --- Core Activity Data ---
  name: text("name").notNull(),
  description: text("description"),
  type: text("type"),                               // 'Run', 'Ride', 'Swim', etc.
  sportType: text("sport_type"),                     // 'Run', 'TrailRun', 'MountainBikeRide', etc.
  workoutType: integer("workout_type"),              // Strava workout_type code

  // --- Metrics ---
  distance: doublePrecision("distance"),             // meters
  movingTime: integer("moving_time"),                // seconds
  elapsedTime: integer("elapsed_time"),              // seconds
  totalElevationGain: real("total_elevation_gain"),  // meters
  averageSpeed: real("average_speed"),               // m/s
  maxSpeed: real("max_speed"),                       // m/s
  averageHeartrate: real("average_heartrate"),        // bpm
  maxHeartrate: integer("max_heartrate"),             // bpm
  averageCadence: real("average_cadence"),            // rpm or spm
  averageWatts: real("average_watts"),                // watts
  maxWatts: integer("max_watts"),                     // watts
  weightedAverageWatts: integer("weighted_average_watts"), // normalized power
  kilojoules: real("kilojoules"),                    // kJ
  calories: real("calories"),                        // kcal
  deviceWatts: boolean("device_watts"),              // true = real power meter
  hasHeartrate: boolean("has_heartrate"),

  // --- Elevation ---
  elevHigh: real("elev_high"),                       // meters
  elevLow: real("elev_low"),                         // meters

  // --- Environment ---
  averageTemp: real("average_temp"),                 // °C
  timezone: text("timezone"),

  // --- Time ---
  startDate: timestamp("start_date"),                // UTC
  startDateLocal: timestamp("start_date_local"),     // local time

  // --- Map / GPS ---
  polyline: text("polyline"),                        // encoded polyline
  summaryPolyline: text("summary_polyline"),          // simplified polyline
  startLatlng: jsonb("start_latlng"),                // [lat, lng]
  endLatlng: jsonb("end_latlng"),                    // [lat, lng]

  // --- Stats ---
  prCount: integer("pr_count"),
  sufferScore: integer("suffer_score"),               // Strava relative effort
  achievementCount: integer("achievement_count"),

  // --- Device / Gear ---
  gearId: text("gear_id"),                           // Strava gear ID
  deviceName: text("device_name"),                   // e.g. "Garmin Forerunner 265"

  // --- Flags ---
  trainer: boolean("trainer"),
  commute: boolean("commute"),
  manual: boolean("manual"),
  private: boolean("private"),
  flagged: boolean("flagged"),

  // --- Complex / Nested Data (JSONB) ---
  splitsMetric: jsonb("splits_metric"),               // StravaSplit[]
  stravaLaps: jsonb("strava_laps"),                   // StravaLap[]  (named differently to avoid conflict with existing `laps` table)
  bestEfforts: jsonb("best_efforts"),                 // StravaBestEffort[]
  segmentEfforts: jsonb("segment_efforts"),           // StravaSegmentEffort[]

  // --- Streams (time-series data) ---
  heartrateStream: jsonb("heartrate_stream"),         // number[]
  cadenceStream: jsonb("cadence_stream"),             // number[]
  wattsStream: jsonb("watts_stream"),                 // number[]
  velocityStream: jsonb("velocity_stream"),           // number[] (m/s)
  altitudeStream: jsonb("altitude_stream"),           // number[]
  distanceStream: jsonb("distance_stream"),           // number[] (cumulative meters)
  timeStream: jsonb("time_stream"),                   // number[] (seconds from start)
  latlngStream: jsonb("latlng_stream"),               // [lat, lng][]
  gradeStream: jsonb("grade_stream"),                 // number[] (%)
  tempStream: jsonb("temp_stream"),                   // number[] (°C)

  // --- Timestamps ---
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("activities_external_strava_id_idx").on(table.externalStravaId),
]);

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  password: text("password"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);
