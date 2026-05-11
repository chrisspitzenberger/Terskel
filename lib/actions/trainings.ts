"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { trainings, laps } from "@/lib/db/drizzle-schema";
import { eq, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import type { CreateTrainingForm, LapInput, Training, Lap } from "@/lib/db/schemas";
import { calculatePace } from "@/lib/calculations/pace";

export async function getTrainingsAction(): Promise<Training[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;

  const userTrainings = await db.select().from(trainings).where(eq(trainings.userId, userId)).orderBy(desc(trainings.date));

  if (userTrainings.length === 0) return [];

  const trainingIds = userTrainings.map(t => t.id);
  const allLaps = await db.select().from(laps).where(inArray(laps.trainingId, trainingIds));

  return userTrainings.map(t => ({
    id: t.id,
    date: t.date.toISOString(),
    title: t.title,
    type: t.type,
    environment: t.environment || undefined,
    notes: t.notes || undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    laps: allLaps.filter(l => l.trainingId === t.id).map(l => ({
      id: l.id,
      type: l.type,
      distance_m: l.distanceM,
      duration_s: l.durationS,
      pace_min_km: l.paceMinKm || undefined,
      avg_hr: l.avgHr,
      max_hr: l.maxHr,
      lactate_mmol: l.lactateMmol,
      linkedEffortId: l.linkedEffortId || undefined,
      notes: l.notes || undefined,
    })),
  }));
}

export async function getTrainingAction(id: string): Promise<Training | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const t = await db.select().from(trainings).where(eq(trainings.id, id)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) return null;

  const tLaps = await db.select().from(laps).where(eq(laps.trainingId, id));

  return {
    id: t.id,
    date: t.date.toISOString(),
    title: t.title,
    type: t.type,
    environment: t.environment || undefined,
    notes: t.notes || undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    laps: tLaps.map(l => ({
      id: l.id,
      type: l.type,
      distance_m: l.distanceM,
      duration_s: l.durationS,
      pace_min_km: l.paceMinKm || undefined,
      avg_hr: l.avgHr,
      max_hr: l.maxHr,
      lactate_mmol: l.lactateMmol,
      linkedEffortId: l.linkedEffortId || undefined,
      notes: l.notes || undefined,
    })),
  };
}

export async function createTrainingAction(form: CreateTrainingForm): Promise<Training> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const id = uuidv4();
  const now = new Date();

  await db.insert(trainings).values({
    id,
    userId: session.user.id,
    date: new Date(form.date),
    title: form.title,
    type: form.type,
    environment: form.environment || null,
    notes: form.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/trainings");
  revalidatePath("/");

  return {
    id,
    date: form.date,
    title: form.title,
    type: form.type,
    environment: form.environment,
    notes: form.notes,
    laps: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function deleteTrainingAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify ownership
  const t = await db.select().from(trainings).where(eq(trainings.id, id)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) throw new Error("Unauthorized or not found");

  await db.delete(trainings).where(eq(trainings.id, id));

  revalidatePath("/trainings");
  revalidatePath("/");
}

export async function addLapAction(trainingId: string, lapData: LapInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const t = await db.select().from(trainings).where(eq(trainings.id, trainingId)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) throw new Error("Unauthorized or not found");

  const pace = calculatePace(lapData.distance_m, lapData.duration_s);
  const id = uuidv4();

  await db.insert(laps).values({
    id,
    trainingId,
    type: lapData.type,
    distanceM: lapData.distance_m,
    durationS: lapData.duration_s,
    paceMinKm: pace,
    avgHr: lapData.avg_hr ?? null,
    maxHr: lapData.max_hr ?? null,
    lactateMmol: lapData.lactate_mmol ?? null,
    linkedEffortId: lapData.linkedEffortId ?? null,
    notes: lapData.notes ?? null,
  });

  revalidatePath(`/trainings/${trainingId}`);
  revalidatePath("/trainings");
  revalidatePath("/");
}

export async function deleteLapAction(trainingId: string, lapId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const t = await db.select().from(trainings).where(eq(trainings.id, trainingId)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) throw new Error("Unauthorized or not found");

  await db.delete(laps).where(eq(laps.id, lapId));

  revalidatePath(`/trainings/${trainingId}`);
  revalidatePath("/trainings");
  revalidatePath("/");
}

export async function updateLapAction(trainingId: string, lapId: string, lapData: Partial<LapInput>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const t = await db.select().from(trainings).where(eq(trainings.id, trainingId)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) throw new Error("Unauthorized or not found");

  const updateData: any = {};
  if (lapData.type) updateData.type = lapData.type;
  if (lapData.distance_m !== undefined) updateData.distanceM = lapData.distance_m;
  if (lapData.duration_s !== undefined) updateData.durationS = lapData.duration_s;
  if (lapData.avg_hr !== undefined) updateData.avgHr = lapData.avg_hr;
  if (lapData.max_hr !== undefined) updateData.maxHr = lapData.max_hr;
  if (lapData.lactate_mmol !== undefined) updateData.lactateMmol = lapData.lactate_mmol;
  if (lapData.linkedEffortId !== undefined) updateData.linkedEffortId = lapData.linkedEffortId;
  if (lapData.notes !== undefined) updateData.notes = lapData.notes;

  if (lapData.distance_m !== undefined && lapData.duration_s !== undefined) {
    updateData.paceMinKm = calculatePace(lapData.distance_m, lapData.duration_s);
  }

  await db.update(laps).set(updateData).where(eq(laps.id, lapId));

  revalidatePath(`/trainings/${trainingId}`);
  revalidatePath("/trainings");
  revalidatePath("/");
}

export async function updateTrainingAction(id: string, updates: Partial<Training>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const t = await db.select().from(trainings).where(eq(trainings.id, id)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) throw new Error("Unauthorized or not found");

  const updateData: any = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.environment !== undefined) updateData.environment = updates.environment;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  await db.update(trainings).set({
    ...updateData,
    updatedAt: new Date()
  }).where(eq(trainings.id, id));

  revalidatePath(`/trainings/${id}`);
  revalidatePath("/trainings");
  revalidatePath("/");
}

