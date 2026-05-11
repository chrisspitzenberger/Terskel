"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/drizzle-schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { updateNameSchema, updateEmailSchema, updatePasswordSchema } from "@/lib/db/schemas";

export async function updateNameAction(values: z.infer<typeof updateNameSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validatedFields = updateNameSchema.safeParse(values);
  if (!validatedFields.success) return { error: "Invalid fields" };

  try {
    await db.update(users)
      .set({ name: validatedFields.data.name })
      .where(eq(users.id, session.user.id));
    
    revalidatePath("/settings/profile");
    return { success: "Name updated successfully" };
  } catch (error) {
    console.error(error);
    return { error: "Failed to update name" };
  }
}

export async function updateEmailAction(values: z.infer<typeof updateEmailSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validatedFields = updateEmailSchema.safeParse(values);
  if (!validatedFields.success) return { error: "Invalid fields" };

  try {
    const existing = await db.select().from(users).where(eq(users.email, validatedFields.data.email)).then(res => res[0]);
    if (existing && existing.id !== session.user.id) {
      return { error: "Email already in use" };
    }

    await db.update(users)
      .set({ email: validatedFields.data.email })
      .where(eq(users.id, session.user.id));
    
    revalidatePath("/settings/profile");
    return { success: "Email updated successfully. Verification required." };
  } catch (error) {
    console.error(error);
    return { error: "Failed to update email" };
  }
}

export async function updatePasswordAction(values: z.infer<typeof updatePasswordSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const validatedFields = updatePasswordSchema.safeParse(values);
  if (!validatedFields.success) return { error: "Invalid fields" };

  const { currentPassword, newPassword } = validatedFields.data;

  try {
    const user = await db.select().from(users).where(eq(users.id, session.user.id)).then(res => res[0]);
    if (!user || !user.password) return { error: "User not found or using OAuth" };

    const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordsMatch) return { error: "Incorrect current password" };

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users)
      .set({ password: hashedNewPassword })
      .where(eq(users.id, session.user.id));
    
    return { success: "Password updated successfully" };
  } catch (error) {
    console.error(error);
    return { error: "Failed to update password" };
  }
}

export async function deleteAccountAction() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  try {
    await db.delete(users).where(eq(users.id, session.user.id));
    return { success: "Account deleted successfully" };
  } catch (error) {
    console.error(error);
    return { error: "Failed to delete account" };
  }
}

export async function uploadProfilePictureAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  try {
    const file = formData.get("file") as File;
    if (!file) return { error: "No file provided" };
    
    console.log("Uploading file:", file.name);
    // Placeholder upload logic
    const mockUrl = "https://github.com/shadcn.png"; 

    await db.update(users)
      .set({ image: mockUrl })
      .where(eq(users.id, session.user.id));
      
    revalidatePath("/settings/profile");
    return { success: "Profile picture uploaded successfully" };
  } catch (error) {
    console.error(error);
    return { error: "Failed to upload profile picture" };
  }
}
