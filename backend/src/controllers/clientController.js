const Client = require("../models/Client");
const { audit } = require("../utils/audit");
const { httpError } = require("../utils/httpError");

function publicClient(client) {
  return {
    id: String(client._id),
    name: client.name,
    status: client.status,
    locations: client.locations || [],
    safeExportsEnabled: client.safeExportsEnabled
  };
}

async function listClients(req, res) {
  const query = { organizationId: req.user.organizationId };
  if (!["super_admin", "admin"].includes(req.user.role)) {
    query._id = { $in: req.user.clientIds };
  }
  const clients = await Client.find(query).sort({ name: 1 });
  res.json({ clients: clients.map(publicClient) });
}

async function createClient(req, res) {
  const client = await Client.create({ ...req.validated.body, organizationId: req.user.organizationId });
  await audit(req, "client.created", { type: "client", id: String(client._id) });
  res.status(201).json({ client: publicClient(client) });
}

async function updateClient(req, res) {
  const client = await Client.findOneAndUpdate(
    { _id: req.validated.params.id, organizationId: req.user.organizationId },
    { $set: req.validated.body },
    { new: true, runValidators: true }
  );
  if (!client) throw httpError(404, "Client not found");
  await audit(req, "client.updated", { type: "client", id: String(client._id) });
  res.json({ client: publicClient(client) });
}

module.exports = { listClients, createClient, updateClient };
