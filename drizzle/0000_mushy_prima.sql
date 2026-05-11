CREATE TYPE "public"."environment" AS ENUM('track', 'treadmill', 'road', 'trail');--> statement-breakpoint
CREATE TYPE "public"."lap_type" AS ENUM('effort', 'rest');--> statement-breakpoint
CREATE TYPE "public"."step_test_mode" AS ENUM('manual', 'smart');--> statement-breakpoint
CREATE TYPE "public"."step_test_status" AS ENUM('setup', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."training_type" AS ENUM('interval', 'long_run', 'tempo', 'step_test', 'easy', 'race');--> statement-breakpoint
CREATE TABLE "laps" (
	"id" text PRIMARY KEY NOT NULL,
	"training_id" text NOT NULL,
	"type" "lap_type" NOT NULL,
	"distance_m" integer NOT NULL,
	"duration_s" integer NOT NULL,
	"pace_min_km" real,
	"avg_hr" integer,
	"max_hr" integer,
	"lactate_mmol" real,
	"linked_effort_id" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "step_test_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"step_test_id" text NOT NULL,
	"step_number" integer NOT NULL,
	"target_pace_min_km" real NOT NULL,
	"actual_pace_min_km" real,
	"end_hr" integer,
	"lactate_mmol" real,
	"completed" boolean DEFAULT false NOT NULL,
	"skipped" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "step_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"title" text NOT NULL,
	"status" "step_test_status" NOT NULL,
	"protocol" jsonb NOT NULL,
	"results" jsonb,
	"resting_lactate" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainings" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"title" text NOT NULL,
	"type" "training_type" NOT NULL,
	"environment" "environment",
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "laps" ADD CONSTRAINT "laps_training_id_trainings_id_fk" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_test_steps" ADD CONSTRAINT "step_test_steps_step_test_id_step_tests_id_fk" FOREIGN KEY ("step_test_id") REFERENCES "public"."step_tests"("id") ON DELETE cascade ON UPDATE no action;