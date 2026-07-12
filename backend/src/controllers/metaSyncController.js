const MetaPage = require("../models/MetaPage");
const { getEnv } = require("../config/env");
const { decryptSecret } = require("../utils/encryption");
const { upsertMetaLead } = require("../utils/metaLeads");
const { httpError } = require("../utils/httpError");

async function fetchAllPages(url) {
  const results = [];
  let nextUrl = url;
  let pageCount = 0;
  while (nextUrl && pageCount < 10) {
    const response = await fetch(nextUrl);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Meta Graph API request failed");
    results.push(...(data.data || []));
    nextUrl = data.paging?.next;
    pageCount += 1;
  }
  return results;
}

async function syncLeadsNow(req, res) {
  const env = getEnv();
  const pages = await MetaPage.find({ organizationId: req.user.organizationId }).select("+encryptedPageAccessToken");
  if (!pages.length) throw httpError(404, "No connected Meta Pages found. Reconnect Meta first.");

  let formsScanned = 0;
  let leadsProcessed = 0;
  const errors = [];

  for (const page of pages) {
    const pageAccessToken = decryptSecret(page.encryptedPageAccessToken);

    let forms;
    try {
      forms = await fetchAllPages(
        `https://graph.facebook.com/${env.metaGraphVersion}/${page.pageId}/leadgen_forms?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`
      );
    } catch (error) {
      errors.push(`${page.pageName || page.pageId}: ${error.message}`);
      continue;
    }

    for (const form of forms) {
      formsScanned += 1;
      let leadItems;
      try {
        leadItems = await fetchAllPages(
          `https://graph.facebook.com/${env.metaGraphVersion}/${form.id}/leads?fields=field_data,created_time,ad_id,campaign_id&access_token=${encodeURIComponent(pageAccessToken)}`
        );
      } catch (error) {
        errors.push(`${form.name || form.id}: ${error.message}`);
        continue;
      }

      for (const leadItem of leadItems) {
        await upsertMetaLead({
          organizationId: page.organizationId,
          clientId: page.clientId,
          externalId: leadItem.id,
          fieldData: leadItem.field_data,
          createdTime: leadItem.created_time,
          campaignId: leadItem.campaign_id,
          formId: form.id
        });
        leadsProcessed += 1;
      }
    }

    await MetaPage.updateOne({ _id: page._id }, { $set: { lastLeadAt: new Date() } });
  }

  res.json({ pagesScanned: pages.length, formsScanned, leadsProcessed, errors });
}

module.exports = { syncLeadsNow };
