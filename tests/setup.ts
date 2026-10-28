// Test environment defaults. DATABASE_URL must point at a disposable PostgreSQL database that
// has had `prisma migrate deploy` applied (CI does this; see .github/workflows/ci.yml).

process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.HASH_PEPPER ??= "test-pepper";
process.env.EMAIL_PROVIDER = "memory";
process.env.APP_URL ??= "http://localhost:3000";
process.env.STAFF_MFA_REQUIRED ??= "true";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set to a disposable test database to run the integration tests.");
}
