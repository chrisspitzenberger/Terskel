"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { stepTests, stepTestSteps } from "@/lib/db/drizzle-schema";
import { eq, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import type { StepTest, StepData, StepTestProtocol, StepTestResults } from "@/lib/db/schemas";

export async function getStepTestsAction(): Promise<StepTest[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;

  const userTests = await db.select().from(stepTests).where(eq(stepTests.userId, userId)).orderBy(desc(stepTests.date));

  if (userTests.length === 0) return [];

  const testIds = userTests.map(t => t.id);
  const allSteps = await db.select().from(stepTestSteps).where(inArray(stepTestSteps.stepTestId, testIds));

  return userTests.map(t => ({
    id: t.id,
    date: t.date.toISOString(),
    title: t.title,
    status: t.status,
    protocol: t.protocol as StepTestProtocol,
    results: (t.results as StepTestResults) || undefined,
    resting_lactate: t.restingLactate || undefined,
    notes: t.notes || undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    steps: allSteps.filter(s => s.stepTestId === t.id).map(s => ({
      step_number: s.stepNumber,
      target_pace_min_km: s.targetPaceMinKm,
      actual_pace_min_km: s.actualPaceMinKm || undefined,
      end_hr: s.endHr,
      lactate_mmol: s.lactateMmol,
      completed: s.completed,
      skipped: s.skipped || undefined,
    })),
  }));
}

export async function getStepTestAction(id: string): Promise<StepTest | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const t = await db.select().from(stepTests).where(eq(stepTests.id, id)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) return null;

  const tSteps = await db.select().from(stepTestSteps).where(eq(stepTestSteps.stepTestId, id));

  return {
    id: t.id,
    date: t.date.toISOString(),
    title: t.title,
    status: t.status,
    protocol: t.protocol as StepTestProtocol,
    results: (t.results as StepTestResults) || undefined,
    resting_lactate: t.restingLactate || undefined,
    notes: t.notes || undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    steps: tSteps.map(s => ({
      step_number: s.stepNumber,
      target_pace_min_km: s.targetPaceMinKm,
      actual_pace_min_km: s.actualPaceMinKm || undefined,
      end_hr: s.endHr,
      lactate_mmol: s.lactateMmol,
      completed: s.completed,
      skipped: s.skipped || undefined,
    })),
  };
}

export async function createStepTestAction(testData: Omit<StepTest, "id" | "createdAt" | "updatedAt">): Promise<StepTest> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const id = uuidv4();
  const now = new Date();

  await db.insert(stepTests).values({
    id,
    userId: session.user.id,
    date: new Date(testData.date),
    title: testData.title,
    status: testData.status,
    protocol: testData.protocol,
    results: testData.results || null,
    restingLactate: testData.resting_lactate || null,
    notes: testData.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  if (testData.steps && testData.steps.length > 0) {
    await db.insert(stepTestSteps).values(
      testData.steps.map(s => ({
        id: uuidv4(),
        stepTestId: id,
        stepNumber: s.step_number,
        targetPaceMinKm: s.target_pace_min_km,
        actualPaceMinKm: s.actual_pace_min_km || null,
        endHr: s.end_hr || null,
        lactateMmol: s.lactate_mmol || null,
        completed: s.completed,
        skipped: s.skipped || false,
      }))
    );
  }

  revalidatePath("/step-test");
  revalidatePath("/");

  return {
    ...testData,
    id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function updateStepTestAction(id: string, updates: Partial<StepTest>): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const t = await db.select().from(stepTests).where(eq(stepTests.id, id)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) throw new Error("Unauthorized or not found");

  const now = new Date();

  if (updates.title || updates.status || updates.results || updates.resting_lactate || updates.notes) {
    await db.update(stepTests).set({
      title: updates.title,
      status: updates.status,
      results: updates.results || null,
      restingLactate: updates.resting_lactate || null,
      notes: updates.notes || null,
      updatedAt: now,
    }).where(eq(stepTests.id, id));
  }

  if (updates.steps) {
    // For simplicity, if steps are provided, we delete existing and re-insert
    await db.delete(stepTestSteps).where(eq(stepTestSteps.stepTestId, id));
    if (updates.steps.length > 0) {
      await db.insert(stepTestSteps).values(
        updates.steps.map(s => ({
          id: uuidv4(),
          stepTestId: id,
          stepNumber: s.step_number,
          targetPaceMinKm: s.target_pace_min_km,
          actualPaceMinKm: s.actual_pace_min_km || null,
          endHr: s.end_hr || null,
          lactateMmol: s.lactate_mmol || null,
          completed: s.completed,
          skipped: s.skipped || false,
        }))
      );
    }
  }

  revalidatePath(`/step-test/${id}`);
  revalidatePath("/step-test");
  revalidatePath("/");
}

export async function deleteStepTestAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const t = await db.select().from(stepTests).where(eq(stepTests.id, id)).then(res => res[0]);
  if (!t || t.userId !== session.user.id) throw new Error("Unauthorized or not found");

  await db.delete(stepTests).where(eq(stepTests.id, id));

  revalidatePath("/step-test");
  revalidatePath("/");
}
