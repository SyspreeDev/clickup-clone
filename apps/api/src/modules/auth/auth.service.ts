import crypto from "node:crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword, comparePassword } from "../../lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { generateOpaqueToken, hashToken } from "../../lib/tokens";
import { emailProvider } from "../../lib/email";
import { env } from "../../config/env";
import { BadRequestError, ConflictError, UnauthorizedError } from "../../lib/errors";
import type { RegisterInput, LoginInput, ResetPasswordInput } from "@repo/shared-types";

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  timezone: string;
  emailVerified: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    jobTitle: user.jobTitle,
    timezone: user.timezone,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

async function issueTokenPair(userId: string, email: string) {
  const accessToken = signAccessToken({ userId, email });

  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ userId, jti });
  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.jwtRefreshExpiresInMs),
    },
  });

  return { accessToken, refreshToken };
}

async function sendVerificationEmail(userId: string, email: string) {
  const token = generateOpaqueToken();
  await prisma.emailVerificationToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS) },
  });
  const link = `${env.webOrigin}/verify-email/${token}`;
  await emailProvider.send({
    to: email,
    subject: "Verify your email",
    html: `<p>Click to verify your email:</p><p><a href="${link}">${link}</a></p>`,
  });
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  const passwordHash = await hashPassword(input.password);
  let user;

  if (existing) {
    // Placeholder account created via a workspace/team invite, or a Google-only
    // account: claim it by setting a password instead of erroring.
    if (existing.passwordHash) throw new ConflictError("An account with this email already exists");
    user = await prisma.user.update({
      where: { id: existing.id },
      data: { name: input.name, passwordHash },
    });
    await prisma.workspaceMember.updateMany({
      where: { userId: user.id, status: "INVITED" },
      data: { status: "ACTIVE", joinedAt: new Date() },
    });
  } else {
    user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
  }

  await sendVerificationEmail(user.id, user.email);
  const tokens = await issueTokenPair(user.id, user.email);
  return { user: publicUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) throw new UnauthorizedError("Invalid email or password");

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");
  if (!user.isActive) throw new UnauthorizedError("Account disabled");

  const tokens = await issueTokenPair(user.id, user.email);
  return { user: publicUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!stored || stored.tokenHash !== hashToken(refreshToken)) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  if (stored.revoked) {
    // Reuse of a revoked token: possible theft, revoke the whole chain for this user.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revoked: false },
      data: { revoked: true },
    });
    throw new UnauthorizedError("Refresh token reuse detected, all sessions revoked");
  }

  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Refresh token expired");
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw new UnauthorizedError("User not found");

  const newTokens = await issueTokenPair(user.id, user.email);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true, replacedByTokenId: stored.id },
  });

  return { user: publicUser(user), ...newTokens };
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti },
      data: { revoked: true },
    });
  } catch {
    // token already invalid/expired; nothing to revoke
  }
}

export async function verifyEmail(token: string) {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    throw new BadRequestError("Invalid or expired verification link");
  }
  await prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } });
  await prisma.emailVerificationToken.delete({ where: { id: record.id } });
}

export async function resendVerification(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new BadRequestError("User not found");
  if (user.emailVerified) return;
  await sendVerificationEmail(user.id, user.email);
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // don't leak account existence

  const token = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });
  const link = `${env.webOrigin}/reset-password/${token}`;
  await emailProvider.send({
    to: user.email,
    subject: "Reset your password",
    html: `<p>Click to reset your password (expires in 1 hour):</p><p><a href="${link}">${link}</a></p>`,
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  const record = await prisma.passwordResetToken.findUnique({ where: { token: input.token } });
  if (!record || record.used || record.expiresAt < new Date()) {
    throw new BadRequestError("Invalid or expired reset link");
  }

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revoked: true } }),
  ]);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workspaceMemberships: { include: { workspace: true } },
    },
  });
  if (!user) throw new UnauthorizedError();
  return {
    ...publicUser(user),
    workspaces: user.workspaceMemberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      logoUrl: m.workspace.logoUrl,
      role: m.role,
    })),
  };
}

export { publicUser, issueTokenPair };
