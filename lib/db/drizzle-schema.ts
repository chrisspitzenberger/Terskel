import { pgTable, text, timestamp, integer, boolean, real, jsonb, pgEnum, primaryKey } from "drizzle-orm/pg-core";
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
