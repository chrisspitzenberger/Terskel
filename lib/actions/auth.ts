"use server";

import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/drizzle-schema";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { loginSchema, registerSchema } from "@/lib/db/schemas";

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const validatedFields = loginSchema.safeParse({ email, password });

  if (!validatedFields.success) {
    return { error: "Invalid fields" };
  }

  try {
    revalidatePath("/"); // Clear cache for all routes starting from root
    
    await signIn("credentials", {
      email: validatedFields.data.email,
      password: validatedFields.data.password,
      redirect: false,
    });
    
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials." };
        default:
          return { error: "Something went wrong." };
      }
    }
    throw error;
  }
}

export async function registerAction(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const validatedFields = registerSchema.safeParse({ name, email, password, confirmPassword });

  if (!validatedFields.success) {
    return { error: "Invalid fields" };
  }

  const data = validatedFields.data;

  try {
    const existingUser = await db.select().from(users).where(eq(users.email, data.email)).then(res => res[0]);

    if (existingUser) {
      return { error: "Email already in use!" };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    await db.insert(users).values({
      name: data.name,
      email: data.email,
      password: hashedPassword,
    });

    return { success: "User created successfully. You can now log in." };
  } catch (error) {
    console.error("Failed to register:", error);
    return { error: "Internal server error" };
  }
}
