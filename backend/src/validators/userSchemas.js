const { z } = require("zod");
const { roles } = require("../models/User");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ObjectId");

const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(240),
    password: z.string().min(8).max(128),
    role: z.enum(roles),
    clientIds: z.array(objectId).default([]),
    permissions: z
      .object({
        canViewSpend: z.boolean().optional(),
        canExportLeads: z.boolean().optional(),
        canManageMeta: z.boolean().optional(),
        canManageUsers: z.boolean().optional(),
        canManageTemplates: z.boolean().optional()
      })
      .default({})
  })
});

const updateUserSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    role: z.enum(roles).optional(),
    status: z.enum(["active", "invited", "suspended"]).optional(),
    clientIds: z.array(objectId).optional(),
    permissions: z
      .object({
        canViewSpend: z.boolean().optional(),
        canExportLeads: z.boolean().optional(),
        canManageMeta: z.boolean().optional(),
        canManageUsers: z.boolean().optional(),
        canManageTemplates: z.boolean().optional()
      })
      .optional()
  })
});

module.exports = { createUserSchema, updateUserSchema };
