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
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("Google account has no email"));

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
