const express = require("express");
const { login, logout, me, refresh, registerOrganization } = require("../controllers/authController");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { loginSchema, registerOrganizationSchema } = require("../validators/authSchemas");

const router = express.Router();

router.post("/register-organization", validate(registerOrganizationSchema), asyncHandler(registerOrganization));
router.post("/login", validate(loginSchema), asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));

module.exports = router;
