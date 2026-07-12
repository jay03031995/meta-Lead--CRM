const Lead = require("../models/Lead");
const { audit } = require("../utils/audit");
const { httpError } = require("../utils/httpError");

function publicLead(lead) {
  return {
    id: String(lead._id),
    clientId: lead.clientId,
    externalId: lead.externalId,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    quality: lead.quality,
    status: lead.status,
    owner: lead.owner,
    campaign: lead.campaign,
    service: lead.service,
    location: lead.location,
    assetId: lead.assetId,
    intent: lead.intent,
    due: lead.due,
    received: lead.received,
    notes: lead.notes || [],
    latestAction: lead.latestAction,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt
  };
}

async function listLeads(req, res) {
  const query = { organizationId: req.user.organizationId };
  if (!["super_admin", "admin"].includes(req.user.role)) query.clientId = { $in: req.user.clientIds };
  const leads = await Lead.find(query).sort({ received: -1 }).limit(1000);
  res.json({ leads: leads.map(publicLead) });
}

async function createLead(req, res) {
  const lead = await Lead.create({
    ...req.validated.body,
    organizationId: req.user.organizationId,
    due: req.validated.body.due ? new Date(req.validated.body.due) : undefined,
    received: req.validated.body.received ? new Date(req.validated.body.received) : new Date()
  });
  await audit(req, "lead.created", { type: "lead", id: String(lead._id) });
  res.status(201).json({ lead: publicLead(lead) });
}

async function updateLead(req, res) {
  const updates = { ...req.validated.body };
  if (updates.due) updates.due = new Date(updates.due);
  if (updates.received) updates.received = new Date(updates.received);
  const lead = await Lead.findOneAndUpdate(
    { _id: req.validated.params.id, organizationId: req.user.organizationId },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!lead) throw httpError(404, "Lead not found");
  await audit(req, "lead.updated", { type: "lead", id: String(lead._id) });
  res.json({ lead: publicLead(lead) });
}

module.exports = { listLeads, createLead, updateLead };
