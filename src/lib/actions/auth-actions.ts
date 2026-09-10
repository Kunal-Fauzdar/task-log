"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { createUser, getUserByEmail, getUserById, updateUserName, updateUserPassword } from "@/lib/data/user";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateNameSchema,
} from "@/lib/validation/auth";
import { Prisma } from "../../generated/prisma/client.ts";
import type { ActionState } from "@/lib/actions/types";

async function startSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function registerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const user = await createUser({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
    });
    await startSession(user.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "Please fix the errors below.",
        fieldErrors: { email: ["An account with this email already exists"] },
      };
    }
    throw error;
  }

  redirect("/dashboard");
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Incorrect email or password." };
  }

  const user = await getUserByEmail(parsed.data.email);
  // Same generic message whether the email is unknown or the password is wrong — don't leak
  // which emails have accounts.
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    return { status: "error", message: "Incorrect email or password." };
  }

  await startSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

export async function changePasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await getUserById(current.id);
  if (!user) redirect("/login");

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    };
  }

  await updateUserPassword(user.id, await hashPassword(parsed.data.newPassword));
  return { status: "success", message: "Password updated." };
}

export async function updateNameAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const parsed = updateNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await updateUserName(current.id, parsed.data.name);
  return { status: "success", message: "Name updated." };
}
