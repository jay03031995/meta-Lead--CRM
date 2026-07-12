const User = require("../models/User");
const { publicUser } = require("./authController");
const { audit } = require("../utils/audit");
const { httpError } = require("../utils/httpError");

function enforceClientRoleSafety(body) {
  if (["client_user", "client_viewer", "team_member"].includes(body.role)) {
    body.permissions = {
      ...body.permissions,
      canViewSpend: false,
      canManageMeta: false,
      canManageUsers: false
    };
  }
}

async function listUsers(req, res) {
  const query = { organizationId: req.user.organizationId };
  if (req.user.role === "client_user" || req.user.role === "client_viewer") {
    query.clientIds = { $in: req.user.clientIds };
  }
  const users = await User.find(query).select(User.safeFields()).sort({ createdAt: -1 });
  res.json({ users: users.map(publicUser) });
}

async function createUser(req, res) {
  const body = { ...req.validated.body };
  enforceClientRoleSafety(body);
  const passwordHash = await User.hashPassword(body.password);
  const user = await User.create({
    organizationId: req.user.organizationId,
    name: body.name,
    email: body.email,
    passwordHash,
    role: body.role,
    clientIds: body.clientIds,
    permissions: body.permissions
  });
  await audit(req, "user.created", { type: "user", id: String(user._id), metadata: { role: user.role } });
  res.status(201).json({ user: publicUser(user) });
}

async function updateUser(req, res) {
  const body = { ...req.validated.body };
  enforceClientRoleSafety(body);
  const user = await User.findOne({
    _id: req.validated.params.id,
    organizationId: req.user.organizationId
  });
  if (!user) throw httpError(404, "User not found");

  if (body.name !== undefined) user.name = body.name;
  if (body.role !== undefined) user.role = body.role;
  if (body.status !== undefined) user.status = body.status;
  if (body.clientIds !== undefined) user.clientIds = body.clientIds;
  if (body.permissions !== undefined) user.permissions = { ...user.permissions, ...body.permissions };

  await user.save();
  await audit(req, "user.updated", { type: "user", id: String(user._id), metadata: body });
  res.json({ user: publicUser(user) });
}

async function revokeUserSessions(req, res) {
  const user = await User.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
  });
  if (!user) throw httpError(404, "User not found");
  user.refreshTokenVersion += 1;
  await user.save();
  await audit(req, "user.sessions_revoked", { type: "user", id: String(user._id) });
  res.status(204).send();
}

module.exports = { listUsers, createUser, updateUser, revokeUserSessions };
