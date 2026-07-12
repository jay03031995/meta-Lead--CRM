const { z } = require("zod");

const email = z.string().email().max(240);
const password = z.string().min(8).max(128);

const loginSchema = z.object({
  body: z.object({
    email,
    password
  })
});

const registerOrganizationSchema = z.object({
  body: z.object({
    organizationName: z.string().min(2).max(120),
    organizationSlug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
    name: z.string().min(2).max(120),
    email,
    password
  })
});

module.exports = { loginSchema, registerOrganizationSchema };
