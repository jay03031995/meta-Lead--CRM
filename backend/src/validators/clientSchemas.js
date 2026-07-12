const { z } = require("zod");

const clientBody = z.object({
  name: z.string().min(1).max(160),
  status: z.enum(["active", "paused", "archived"]).optional(),
  locations: z.array(z.string().max(160)).max(50).optional(),
  safeExportsEnabled: z.boolean().optional()
});

const createClientSchema = z.object({ body: clientBody });
const updateClientSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: clientBody.partial()
});

module.exports = { createClientSchema, updateClientSchema };
