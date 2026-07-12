const { connectDb } = require("../config/db");
const Organization = require("../models/Organization");
const User = require("../models/User");

async function seed() {
  await connectDb();
  const organization = await Organization.findOneAndUpdate(
    { slug: "agency" },
    { name: "Agency Workspace", slug: "agency", plan: "agency", status: "active" },
    { upsert: true, new: true }
  );

  const email = process.env.SUPER_ADMIN_EMAIL || "admin@example.com";
  const existing = await User.findOne({ organizationId: organization._id, email });
  if (existing) {
    console.log(`Super Admin already exists: ${email}`);
    process.exit(0);
  }

  const password = process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await User.hashPassword(password);
  await User.create({
    organizationId: organization._id,
    name: process.env.SUPER_ADMIN_NAME || "Jay Sharma",
    email,
    passwordHash,
    role: "super_admin",
    permissions: {
      canViewSpend: true,
      canExportLeads: true,
      canManageMeta: true,
      canManageUsers: true,
      canManageTemplates: true
    }
  });

  console.log(`Created Super Admin: ${email}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
