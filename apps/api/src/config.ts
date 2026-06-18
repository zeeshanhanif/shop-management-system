/** Typed environment configuration. Fails fast at boot if something required is missing. */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  stripe: {
    secretKey: required("STRIPE_SECRET_KEY"),
    webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
  },
  email: {
    apiKey: process.env.EMAIL_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "Shop <orders@example.com>",
  },
  reservationTimeoutMinutes: Number(process.env.RESERVATION_TIMEOUT_MINUTES ?? 30),
} as const;
