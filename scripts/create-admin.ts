/* Creates an administrator account from the command line.
 * Usage: DATABASE_URL=... DIRECT_URL=... DATA_ENCRYPTION_KEY=... HASH_PEPPER=... \
 *        npm run create-admin -- "Full Name" admin@example.com 'a-strong-password-123' */

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: npm run create-admin -- "Full Name" email@example.com "password"');
    process.exit(1);
  }
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    console.error("Password must be at least 12 characters and contain letters and numbers.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const existing = await prisma.staffUser.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.error("A staff account with that email already exists.");
    process.exit(1);
  }
  const user = await prisma.staffUser.create({
    data: {
      name,
      email: email.toLowerCase(),
      role: "ADMIN",
      passwordHash: await hash(password, 12),
      agentProfile: { create: { maxActiveOrders: 5 } },
    },
  });
  await prisma.auditLog.create({ data: { actorType: "SYSTEM", action: "staff.created", entityType: "StaffUser", entityId: user.id, metadata: { role: "ADMIN", via: "cli" } } });
  console.log(`Administrator created: ${user.email}. Sign in at /staff/login and set up two-factor authentication.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
