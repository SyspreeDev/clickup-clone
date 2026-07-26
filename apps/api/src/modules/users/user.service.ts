import { prisma } from "../../lib/prisma";
import { comparePassword, hashPassword } from "../../lib/password";
import { generateOpaqueToken, hashToken } from "../../lib/tokens";
import { UnauthorizedError, BadRequestError } from "../../lib/errors";

export async function updateProfile(
  userId: string,
  input: { name?: string; jobTitle?: string; phone?: string; timezone?: string; avatarUrl?: string },
) {
  return prisma.user.update({ where: { id: userId }, data: input });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) throw new BadRequestError("No password set on this account");
  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Current password is incorrect");

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } }),
  ]);
}

export async function listApiTokens(userId: string) {
  return prisma.apiToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, name: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createApiToken(userId: string, name: string) {
  const token = generateOpaqueToken();
  const record = await prisma.apiToken.create({
    data: { userId, name, tokenHash: hashToken(token) },
  });
  return { id: record.id, name: record.name, token: `fs_${token}`, createdAt: record.createdAt };
}

export async function revokeApiToken(userId: string, id: string) {
  await prisma.apiToken.updateMany({ where: { id, userId }, data: { revokedAt: new Date() } });
}
