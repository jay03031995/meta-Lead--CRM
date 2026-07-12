const { z } = require("zod");

const leadBody = z.object({
  clientId: z.string().max(120).optional(),
  externalId: z.string().max(240).optional(),
  name: z.string().min(1).max(160),
  phone: z.string().max(80).optional(),
  email: z.string().email().max(240).or(z.literal("")).optional(),
  source: z.string().max(160).optional(),
  quality: z.string().max(80).optional(),
  status: z.string().max(80).optional(),
  owner: z.string().max(160).optional(),
  campaign: z.string().max(240).optional(),
  service: z.string().max(160).optional(),
  location: z.string().max(160).optional(),
  assetId: z.string().max(240).optional(),
  intent: z.string().max(240).optional(),
  due: z.string().datetime().optional(),
  received: z.string().datetime().optional(),
  notes: z.array(z.string().max(1000)).max(100).optional()
});

const createLeadSchema = z.object({ body: leadBody });
const updateLeadSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: leadBody.partial()
});

module.exports = { createLeadSchema, updateLeadSchema };
