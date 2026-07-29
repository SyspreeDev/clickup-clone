import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env, isGoogleOAuthConfigured } from "../../config/env";
import { prisma } from "../../lib/prisma";

/**
 * Only registers the Google strategy if GOOGLE_CLIENT_ID/SECRET are present.
 * The rest of auth (register/login/reset/verify) works fully without this —
 * see auth.routes.ts, which 501s the /google routes when this is false.
 */
export function configureGoogleStrategy() {
  if (!isGoogleOAuthConfigured) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId!,
        clientSecret: env.googleClientSecret!,
        callbackURL: env.googleCallbackUrl!,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const primary = profile.emails?.[0];
          const email = primary?.value;
          if (!email) return done(new Error("Google account has no email"));

          // Matching on email is what lets Google sign-in adopt an account that
          // already registered with a password. That is only safe while Google
          // vouches for the address — an unverified one would let anyone who can
          // set an arbitrary email on a Google account walk into someone else's.
          const verified = (primary as { verified?: boolean | string }).verified;
          if (verified === false || verified === "false") {
            return done(new Error("Google has not verified this email address"));
          }

          const existingAccount = await prisma.account.findUnique({
            where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.id } },
          });
          if (existingAccount) {
            const user = await prisma.user.findUnique({ where: { id: existingAccount.userId } });
            return done(null, user ?? undefined);
          }

          const user = await prisma.user.upsert({
            where: { email },
            update: { emailVerified: true },
            create: {
              email,
              name: profile.displayName || email,
              avatarUrl: profile.photos?.[0]?.value,
              emailVerified: true,
            },
          });

          await prisma.account.create({
            data: { userId: user.id, provider: "google", providerAccountId: profile.id },
          });

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}
