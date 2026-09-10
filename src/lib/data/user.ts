import { prisma } from "@/lib/db";

export function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function createUser(data: { email: string; name: string; passwordHash: string }) {
  return prisma.user.create({ data });
}

export function updateUserPassword(id: string, passwordHash: string) {
  return prisma.user.update({ where: { id }, data: { passwordHash } });
}

export function updateUserName(id: string, name: string) {
  return prisma.user.update({ where: { id }, data: { name } });
}
