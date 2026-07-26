import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  corsAllowAll: process.env.CORS_ALLOW_ALL === "true",

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  jwtRefreshExpiresInMs: 30 * 24 * 60 * 60 * 1000,

  googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || undefined,

  emailProvider: process.env.EMAIL_PROVIDER ?? "console",
  resendApiKey: process.env.RESEND_API_KEY || undefined,
  emailFrom: process.env.EMAIL_FROM || undefined,

  zoomAccountId: process.env.ZOOM_ACCOUNT_ID || undefined,
  zoomClientId: process.env.ZOOM_CLIENT_ID || undefined,
  zoomClientSecret: process.env.ZOOM_CLIENT_SECRET || undefined,

  storageProvider: process.env.STORAGE_PROVIDER ?? "local",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",

  webOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};

export const isGoogleOAuthConfigured = Boolean(
  env.googleClientId && env.googleClientSecret,
);

export const isZoomConfigured = Boolean(
  env.zoomAccountId && env.zoomClientId && env.zoomClientSecret,
);
