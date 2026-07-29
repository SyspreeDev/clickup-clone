/**
 * Sets a password on an existing account.
 *
 *   pnpm --filter api db:set-password <email> '<new-password>'
 *
 * Needed because password reset emails go to the console provider, so a reset
 * link only ever appears in the server log — there is no way to recover an
 * account from the UI alone. Hashes use the same cost as registration, so the
 * result is indistinguishable from a normally chosen password.
 *
 * Quote the password so the shell doesn't interpret it, and prefer a throwaway
 * one for demo accounts.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    throw new Error("Usage: pnpm --filter api db:set-password <email> '<new-password>'");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters, matching the register schema");
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, passwordHash: true, accounts: { select: { provider: true } } },
  });
  if (!user) throw new Error(`No user with email "${email}"`);

  await prisma.user.update({
    where: { id: user.id },
    // emailVerified too: an account that has never confirmed its address would
    // otherwise sign in and immediately be nagged to verify by email it cannot receive.
    data: { passwordHash: await hashPassword(password), emailVerified: true },
  });

  const was = user.passwordHash ? "replaced the existing password" : "added a password (had none)";
  console.log(`\n✓ ${user.email} (${user.name}) — ${was}`);
  if (user.accounts.length > 0) {
    console.log(`  Note: also signs in with ${user.accounts.map((a) => a.provider).join(", ")} — both now work.`);
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
