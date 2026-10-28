// Prints fresh random secrets for .env / Vercel environment variables.
import { randomBytes } from "node:crypto";

console.log(`DATA_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`);
console.log(`HASH_PEPPER=${randomBytes(32).toString("base64url")}`);
console.log(`CRON_SECRET=${randomBytes(24).toString("base64url")}`);
console.log(`SETUP_TOKEN=${randomBytes(24).toString("base64url")}`);
