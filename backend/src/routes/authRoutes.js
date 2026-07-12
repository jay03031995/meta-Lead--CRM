const express = require("express");
const { login, logout, me, refresh, registerOrganization } = require("../controllers/authController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { loginSchema, registerOrganizationSchema } = require("../validators/authSchemas");
const { startMetaLogin, metaCallback, metaStatus } = require("../controllers/metaAuthController");
const { requirePermission } = require("../middleware/rbac");

const router = express.Router();

router.post("/register-organization", validate(registerOrganizationSchema), asyncHandler(registerOrganization));
router.post("/login", validate(loginSchema), asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));
router.get("/meta/start", requireAuth, requirePermission("canManageMeta"), asyncHandler(startMetaLogin));
router.get("/meta/callback", requireAuth, requirePermission("canManageMeta"), asyncHandler(metaCallback));
router.get("/meta/status", requireAuth, asyncHandler(metaStatus));

module.exports = router;
