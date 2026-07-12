const express = require("express");
const {
  createUser,
  listUsers,
  revokeUserSessions,
  updateUser
} = require("../controllers/userController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { requirePermission, requireRole } = require("../middleware/rbac");
const { validate } = require("../middleware/validate");
const { createUserSchema, updateUserSchema } = require("../validators/userSchemas");

const router = express.Router();

router.use(requireAuth);

router.get("/", requireRole("super_admin", "admin"), asyncHandler(listUsers));
router.post("/", requirePermission("canManageUsers"), validate(createUserSchema), asyncHandler(createUser));
router.patch("/:id", requirePermission("canManageUsers"), validate(updateUserSchema), asyncHandler(updateUser));
router.post("/:id/revoke-sessions", requirePermission("canManageUsers"), asyncHandler(revokeUserSessions));

module.exports = router;
