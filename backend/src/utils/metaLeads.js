const Lead = require("../models/Lead");

function fieldValue(fieldData, ...names) {
  const lowerNames = names.map((name) => name.toLowerCase());
  const match = (fieldData || []).find((field) => lowerNames.includes(String(field.name).toLowerCase()));
  return match?.values?.[0] || "";
}

async function upsertMetaLead({ organizationId, clientId, externalId, fieldData, createdTime, campaignId, formId }) {
  await Lead.findOneAndUpdate(
    { organizationId, externalId },
    {
      $setOnInsert: {
        organizationId,
        clientId: clientId || "unassigned",
        externalId,
        name: fieldValue(fieldData, "full_name", "name") || "Meta Lead",
        phone: fieldValue(fieldData, "phone_number", "phone"),
        email: fieldValue(fieldData, "email"),
        source: "Meta Lead Form",
        campaign: campaignId || "",
        assetId: formId || "",
        received: createdTime ? new Date(createdTime) : new Date(),
        rawSource: { fieldData, createdTime, campaignId, formId }
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

module.exports = { fieldValue, upsertMetaLead };
