const clients = [{ id: "all", name: "All Accounts" }];
const users = [];
const assets = [{ id: "all", name: "All Locations", clientId: "all" }];
const clientAccess = [];
let leads = [];
let audit = [];

let activeView = "Home";
let activeSavedView = "All";
let metaConnection = {
  connected: false,
  appId: "",
  business: "Not connected",
  tokenStatus: "Waiting for Meta Login",
  lastSync: "Never"
};

const roleConfig = {
  superAdmin: {
    label: "Super Admin",
    nav: ["Home", "Leads", "Pipeline", "Follow-ups", "Campaigns", "Reports", "Team", "Meta Accounts", "WhatsApp Templates", "Settings"],
    help: "Full workspace access with administrative controls.",
    restricted: false,
    clientLocked: false
  },
  accountManager: {
    label: "Admin",
    nav: ["Home", "Leads", "Pipeline", "Follow-ups", "Campaigns", "Reports", "Team", "Meta Accounts", "WhatsApp Templates", "Settings"],
    help: "Assigned client operations, approvals, notes and routing.",
    restricted: false,
    clientLocked: false
  },
  sales: {
    label: "Team Member",
    nav: ["Home", "Leads", "Pipeline", "Follow-ups", "Reports"],
    help: "Assigned leads, outcomes, follow-up dates and contact actions.",
    restricted: true,
    clientLocked: false
  },
  clientAdmin: {
    label: "Client User",
    nav: ["Home", "Leads", "Pipeline", "Follow-ups", "Reports"],
    help: "Own dashboard, safe exports and digest history. Spend is blocked.",
    restricted: true,
    clientLocked: true
  },
  clientViewer: {
    label: "Client Viewer",
    nav: ["Home", "Leads", "Pipeline", "Follow-ups", "Reports"],
    help: "Read-only portal access for one organization. Spend is blocked.",
    restricted: true,
    clientLocked: true
  }
};

const state = {
  role: "superAdmin",
  clientId: "all",
  assetId: "all",
  search: "",
  range: 7,
  selectedLeadId: null
};

const $ = (selector) => document.querySelector(selector);
const API_ORIGIN = window.location.protocol === "file:" ? "http://localhost:4000" : window.location.origin;
const API_BASE = `${API_ORIGIN}/api`;
let authMode = "login";
let authenticatedUser = null;

async function api(path, options = {}) {
  if (window.location.protocol === "file:") return localDemoApi(path, options);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
  } catch (error) {
    throw error;
  }
  if (response.status === 204) return null;
  const rawBody = await response.text();
  let payload = {};
  try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch { payload = {}; }
  if (!response.ok) {
    const message = payload.error?.message || payload.message || `API error ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function localDemoApi(path, options = {}) {
  const storageKey = "metaLeadsDemoUser";
  const savedUser = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (path === "/auth/me") {
    if (!savedUser) throw new Error("No active session");
    return { user: savedUser };
  }
  if (path === "/auth/logout") {
    localStorage.removeItem(storageKey);
    return null;
  }
  if (path === "/auth/register-organization") {
    const body = JSON.parse(options.body || "{}");
    const user = {
      id: `demo-${Date.now()}`,
      organizationId: `demo-org-${Date.now()}`,
      clientIds: [],
      name: body.name,
      email: body.email,
      role: "super_admin",
      status: "active",
      permissions: { canViewSpend: true, canExportLeads: true, canManageMeta: true, canManageUsers: true, canManageTemplates: true }
    };
    localStorage.setItem(storageKey, JSON.stringify(user));
    return { user, demoMode: true };
  }
  if (path === "/auth/login") {
    const body = JSON.parse(options.body || "{}");
    if (!savedUser || savedUser.email.toLowerCase() !== String(body.email || "").toLowerCase()) {
      throw new Error("Demo account not found. Create a workspace first.");
    }
    return { user: savedUser, demoMode: true };
  }
  if (path === "/leads") return { leads: [] };
  if (path === "/auth/meta/status") return { connection: { connected: false } };
  throw new Error("This feature requires the MongoDB API at http://localhost:4000.");
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function applyAuthenticatedUser(user) {
  authenticatedUser = user;
  const initials = user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  document.querySelectorAll(".avatar, .top-avatar").forEach((node) => { node.textContent = initials; });
  const profileName = document.querySelector(".profile-row strong");
  if (profileName) profileName.textContent = user.name;
  const roleMap = { super_admin: "superAdmin", admin: "accountManager", team_member: "sales", client_user: "clientAdmin", client_viewer: "clientViewer" };
  state.role = roleMap[user.role] || "clientViewer";
  $("#roleSelect").value = state.role;
  $("#roleSelect").disabled = true;
  $("#authScreen").hidden = true;
  $("#appShell").hidden = false;
  render();
  void loadRealWorkspaceData();
}

async function loadRealWorkspaceData() {
  try {
    const [result, metaResult] = await Promise.all([api("/leads"), api("/auth/meta/status")]);
    leads = (result.leads || []).map(normalizeApiLead);
    if (metaResult.connection?.connected) {
      metaConnection = {
        connected: true,
        appId: "Configured on server",
        business: metaResult.connection.business || "Meta account",
        tokenStatus: "Connected",
        lastSync: metaResult.connection.lastSync ? new Date(metaResult.connection.lastSync).toLocaleString() : "Connected"
      };
    }
    render();
  } catch (error) {
    leads = [];
    render();
    showToast(error.message || "Could not load leads");
  }
}

async function syncMetaLeadsNow() {
  showToast("Syncing leads from Meta...");
  try {
    const result = await api("/auth/meta/sync", { method: "POST" });
    if (result.errors?.length) {
      console.error("Meta sync errors:", result.errors);
      showToast(`Synced ${result.leadsProcessed} lead(s), ${result.errors.length} error(s) — see console`);
    } else {
      showToast(`Synced ${result.leadsProcessed} lead(s) from ${result.formsScanned} form(s)`);
    }
    await loadRealWorkspaceData();
  } catch (error) {
    showToast(error.message || "Meta sync failed");
  }
}

function normalizeApiLead(lead) {
  const received = new Date(lead.received || lead.createdAt || Date.now());
  return {
    ...lead,
    id: lead.id,
    clientId: lead.clientId || "unassigned",
    assetId: lead.assetId || "",
    phone: lead.phone || "",
    email: lead.email || "",
    owner: lead.owner || "Unassigned",
    campaign: lead.campaign || "Unassigned campaign",
    service: lead.service || "General enquiry",
    location: lead.location || "Unassigned",
    intent: lead.intent || "",
    received,
    due: lead.due ? new Date(lead.due) : new Date(received.getTime() + 2 * 60 * 60 * 1000),
    notes: lead.notes || [],
    latestAction: lead.latestAction || "Lead received",
    confidence: 0,
    reason: "Stored source record"
  };
}

function showAuth() {
  authenticatedUser = null;
  $("#appShell").hidden = true;
  $("#authScreen").hidden = false;
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  $("#registerFields").hidden = !registering;
  $("#organizationName").required = registering;
  $("#authName").required = registering;
  $("#authTitle").textContent = registering ? "Create your workspace" : "Sign in";
  $("#authSubtitle").textContent = registering ? "Set up the first Super Admin for your agency." : "Access your live leads and client accounts.";
  $("#authSubmit").textContent = registering ? "Create workspace" : "Sign in";
  $("#authSwitchPrompt").textContent = registering ? "Already have an account?" : "New to Meta Leads?";
  $("#authModeToggle").textContent = registering ? "Sign in" : "Create an account";
  $("#loginOptions").hidden = registering;
  $("#authError").textContent = "";
}

async function submitAuth(event) {
  event.preventDefault();
  const submit = $("#authSubmit");
  submit.disabled = true;
  $("#authError").textContent = "";
  try {
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const body = authMode === "register"
      ? { organizationName: $("#organizationName").value.trim(), organizationSlug: slugify($("#organizationName").value), name: $("#authName").value.trim(), email, password }
      : { email, password };
    const result = await api(authMode === "register" ? "/auth/register-organization" : "/auth/login", { method: "POST", body: JSON.stringify(body) });
    applyAuthenticatedUser(result.user);
    showToast(result.demoMode ? "Local demo session started" : (authMode === "register" ? "Workspace created" : "Signed in"));
  } catch (error) {
    $("#authError").textContent = error.message === "Failed to fetch"
      ? "The API is offline. Start the backend, then open http://localhost:4000."
      : error.message;
  } finally {
    submit.disabled = false;
  }
}

async function restoreSession() {
  try {
    const result = await api("/auth/me");
    applyAuthenticatedUser(result.user);
  } catch {
    showAuth();
  }
}

async function logout() {
  try { await api("/auth/logout", { method: "POST", body: "{}" }); } catch { /* Local logout still proceeds. */ }
  showAuth();
  $("#authForm").reset();
}

function makeLead(id, name, clientId, source, quality, status, owner, ageMinutes, intent, assetId, city, service) {
  const received = new Date(Date.now() + ageMinutes * 60 * 1000);
  const due = new Date(received.getTime() + 2 * 60 * 60 * 1000);
  return {
    id,
    name,
    clientId,
    source,
    quality,
    status,
    owner,
    intent,
    assetId,
    received,
    due,
    phone: "+1 415 555 " + id.slice(-4),
    email: name.toLowerCase().replaceAll(" ", ".") + "@example.com",
    city,
    location: city,
    service,
    campaign: `${service} campaign`,
    ad: `${service} prospecting ad`,
    form: assetName(assetId),
    followUpType: status === "Follow-up Required" ? "Phone call" : "WhatsApp",
    reminder: "30 minutes before",
    latestAction: status === "New Lead" ? "Awaiting first contact" : "Timeline updated",
    confidence: quality === "Cold Lead" ? 0.74 : quality === "Hot Lead" ? 0.88 : 0.8,
    reason: `${source} matched ${intent.toLowerCase()} rule in classification v1.`,
    notes: ["Source event preserved", "Canonical lead dedupe checked"]
  };
}

function currentRole() {
  return roleConfig[state.role];
}

function clientName(id) {
  return clients.find((client) => client.id === id)?.name || "Unknown client";
}

function assetName(id) {
  return assets.find((asset) => asset.id === id)?.name || "Unknown asset";
}

function isOverdue(lead) {
  return !["Contacted", "Qualified", "Appointment Booked", "Converted", "Closed", "Invalid Lead"].includes(lead.status) && lead.due < new Date();
}

function maskContact(value) {
  if (!currentRole().restricted) return value;
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  return value.replace(/\d(?=\d{2})/g, "•");
}

function visibleLeads() {
  const allowedClient = currentRole().clientLocked ? "northstar" : state.clientId;
  return leads.filter((lead) => {
    const clientOk = allowedClient === "all" || lead.clientId === allowedClient;
    const assetOk = state.assetId === "all" || lead.assetId === state.assetId;
    const searchText = `${lead.name} ${clientName(lead.clientId)} ${lead.owner} ${lead.status} ${lead.source}`.toLowerCase();
    const searchOk = !state.search || searchText.includes(state.search.toLowerCase());
    const savedOk =
      activeSavedView === "All" ||
      (activeSavedView === "Overdue" && isOverdue(lead)) ||
      (activeSavedView === "Hot" && lead.quality === "Hot Lead") ||
      (activeSavedView === "Unassigned" && !lead.owner);
    const rangeOk = Date.now() - lead.received.getTime() <= state.range * 24 * 60 * 60 * 1000;
    return clientOk && assetOk && searchOk && savedOk && rangeOk;
  });
}

function renderNav() {
  const nav = $("#nav");
  const allowed = currentRole().nav;
  if (!allowed.includes(activeView)) activeView = allowed[0];
  nav.innerHTML = allowed
    .map((item) => `<button type="button" data-view="${item}" aria-current="${item === activeView ? "page" : "false"}"><span class="icon">${iconFor(item)}</span><span class="nav-label">${item}</span></button>`)
    .join("");
}

function iconFor(item) {
  const names = { Overview: "home", Home: "home", Leads: "users", Pipeline: "columns", "Follow-ups": "clock", Campaigns: "send", Reports: "chart", Team: "userPlus", "Meta Accounts": "link", "WhatsApp Templates": "message", Integrations: "plug", Admin: "settings", Accounts: "briefcase", Access: "shield", Rules: "sliders", Digests: "mail", Clients: "building", "Audit Log": "list", Settings: "settings" };
  return iconSvg(names[item] || "circle");
}

function iconSvg(name, size = 18) {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    columns: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    userPlus: '<path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 10h8M8 14h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>',
    building: '<path d="M3 21h18M6 21V3h12v18M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-5h4v5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    plug: '<path d="m12 22 4-4M7 7l10 10M9 2l3 3M2 9l3 3M14 5l3-3M5 14l-3 3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    mapPin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    circle: '<circle cx="12" cy="12" r="9"/>'
  };
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.circle}</svg>`;
}

function renderFilters() {
  const clientFilter = $("#clientFilter");
  const options = currentRole().clientLocked ? clients.filter((client) => client.id === "northstar") : clients;
  if (currentRole().clientLocked) state.clientId = "northstar";
  clientFilter.innerHTML = options.map((client) => `<option value="${client.id}">${client.name}</option>`).join("");
  clientFilter.value = state.clientId;
  clientFilter.disabled = currentRole().clientLocked;

  const assetFilter = $("#assetFilter");
  const allowedAssets = assets.filter((asset) => asset.id === "all" || state.clientId === "all" || asset.clientId === state.clientId);
  if (!allowedAssets.some((asset) => asset.id === state.assetId)) state.assetId = "all";
  assetFilter.innerHTML = allowedAssets.map((asset) => `<option value="${asset.id}">${asset.name}</option>`).join("");
  assetFilter.value = state.assetId;
  $("#rangeFilter").value = String(state.range);
}

function render() {
  renderNav();
  renderFilters();
  $("#pageTitle").textContent = activeView;
  $("#roleHelp").textContent = currentRole().help;
  $("#profileRole").textContent = currentRole().label;
  const view = $("#view");
  const renderers = {
    Home: renderHome,
    Overview: renderOverview,
    Leads: renderLeads,
    Pipeline: renderPipeline,
    "Follow-ups": renderFollowUps,
    Campaigns: renderCampaigns,
    Reports: renderReports,
    "Meta Accounts": renderAccounts,
    Integrations: renderIntegrations,
    "WhatsApp Templates": renderIntegrations,
    Admin: renderAdmin,
    Accounts: renderAccounts,
    Access: renderAccess,
    Rules: renderRules,
    Digests: renderDigests,
    Clients: renderClients,
    Team: renderTeam,
    "Audit Log": renderAudit,
    Settings: renderAdmin
  };
  view.innerHTML = renderers[activeView]();
  bindDynamicEvents();
}

function sectionHeader(title, subtitle, stats = []) {
  return `
    <section class="section-hero">
      <div>
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
      <div class="section-stats">
        ${stats.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}
      </div>
    </section>
  `;
}

function renderHome() {
  const data = visibleLeads();
  const cards = [
    ["View Leads", "Leads", "Browse and manage all your leads", "blue", "♙", ""],
    ["Lead Pipeline", "Pipeline", "Track lead progress across stages", "green", "▥", ""],
    ["Follow-ups", "Follow-ups", "View and manage follow-up tasks", "orange", "□", ""],
    ["Reports", "Reports", "Analyze performance and trends", "purple", "◔", ""],
    ["Team Management", "Team", "Manage your team and permissions", "purple", "♙", ""],
    ["Meta Accounts", "Meta Accounts", "Manage connected meta accounts", "blue", "∞", ""],
    ["WhatsApp Templates", "WhatsApp Templates", "Create and manage templates", "whatsapp", "◌", ""],
    ["Settings", "Settings", "Configure system preferences", "gray", "⚙", ""]
  ].filter((card) => currentRole().nav.includes(card[1]));
  return `
    <section class="welcome">
      <div>
        <h2>Welcome back, Jay!</h2>
        <p>Manage your leads, follow-ups, communication, and team activity from one place.</p>
      </div>
    </section>
    <div class="grid home-cards">
      ${cards.map(([title, view, desc, tone, icon, badge]) => `<button class="nav-card" type="button" data-jump="${view}"><span class="card-icon ${tone}">${iconFor(view)}</span><span class="card-copy"><strong>${title}</strong><small>${desc}</small></span>${badge ? `<em>${badge}</em>` : ""}</button>`).join("")}
    </div>
    <div class="grid simple-kpis">
      ${homeKpi("New Leads", data.filter(lead => lead.status === "New Lead").length, "", "live MongoDB data", "blue", "")}
      ${homeKpi("Follow-ups Due", data.filter(isOverdue).length, "", "live MongoDB data", "orange", "")}
      ${homeKpi("Qualified Leads", data.filter(lead => lead.status === "Qualified").length, "", "live MongoDB data", "green", "")}
      ${homeKpi("Pending Leads", data.filter(lead => !["Converted", "Closed", "Invalid Lead"].includes(lead.status)).length, "", "live MongoDB data", "purple", "")}
    </div>
    <section class="analytics-workspace card">
      <div class="analytics-head">
        <div><span class="eyebrow">Campaign intelligence</span><h2>Lead performance</h2><p>Daily volume, qualification and conversion across connected accounts.</p></div>
        <div class="analytics-filters"><button class="secondary-btn" type="button">All channels⌄</button><button class="secondary-btn" type="button">Last 30 days⌄</button><button class="primary-btn" type="button" data-jump="Reports">Full report</button></div>
      </div>
      <div class="analytics-grid">
        <div class="audience-panel">
          <div class="panel-title"><h3>Lead quality</h3><span>${data.length} total</span></div>
          <div class="donut-chart"><div><strong>${data.length ? Math.round(data.filter(lead => lead.status === "Qualified").length / data.length * 100) : 0}%</strong><span>qualified</span></div></div>
          <div class="chart-legend"><span><i class="legend-purple"></i>Hot ${data.filter(lead => lead.quality === "Hot Lead").length}</span><span><i class="legend-pink"></i>Warm ${data.filter(lead => lead.quality === "Warm Lead").length}</span><span><i class="legend-gray"></i>Cold ${data.filter(lead => lead.quality === "Cold Lead").length}</span></div>
        </div>
        <div class="trend-panel">
          <div class="panel-title"><h3>Performance</h3><div class="chart-legend"><span><i class="legend-purple"></i>Leads</span><span><i class="legend-green"></i>Qualified</span><span><i class="legend-orange"></i>Booked</span></div></div>
          <svg class="trend-chart" viewBox="0 0 760 220" role="img" aria-label="Lead performance trend over 30 days">
            <g class="chart-grid"><line x1="20" y1="40" x2="740" y2="40"/><line x1="20" y1="90" x2="740" y2="90"/><line x1="20" y1="140" x2="740" y2="140"/><line x1="20" y1="190" x2="740" y2="190"/></g>
            <polyline class="line leads-line" points="${data.length ? "20,170 200,150 380,130 560,100 740,70" : ""}"/>
            <polyline class="line qualified-line" points="${data.length ? "20,190 200,180 380,165 560,145 740,125" : ""}"/>
            <polyline class="line booked-line" points="${data.length ? "20,200 200,195 380,185 560,175 740,160" : ""}"/>
          </svg>
          <div class="chart-axis"><span>May 1</span><span>May 8</span><span>May 15</span><span>May 22</span><span>May 30</span></div>
        </div>
      </div>
    </section>
    <div class="grid dashboard-bottom">
      <section class="card pad activity-card">
        <h2>Recent Activity</h2>
        <div class="activity-list">
          ${audit.length ? audit.slice(0, 5).map(title => `<div class="activity-row"><span class="mini-icon purple">${iconSvg("list",16)}</span><div><strong>${title}</strong><small>Workspace activity</small></div><time>Recent</time></div>`).join("") : `<p class="muted">No activity yet. Real lead events will appear here.</p>`}
        </div>
        <button class="text-link" type="button">View All Activity →</button>
      </section>
      <div class="right-stack">
        <section class="crm-hero card">
          <div>
            <h2>Open Lead CRM</h2>
            <p>Go to the main CRM to view and manage all your leads in detail.</p>
            <button class="primary-btn" type="button" data-jump="Leads">Open Lead CRM →</button>
          </div>
          <div class="mock-window" aria-hidden="true">
            <div class="mock-bar"><span></span><span></span><span></span></div>
            <div class="mock-table">
              ${Array.from({ length: 5 }, () => `<i></i><i></i><i></i><i></i>`).join("")}
            </div>
            <b>M</b>
          </div>
        </section>
        <section class="card pad performance-card">
          <div class="toolbar">
            <h2>Your Performance <span>(This Month)</span></h2>
            <button class="text-link" type="button" data-jump="Reports">View Report →</button>
          </div>
          <div class="perf-grid">
            <div><span>Leads Handled</span><strong>${data.length}</strong></div>
            <div><span>Follow-ups Done</span><strong>${data.filter(lead => ["Contacted", "Qualified", "Appointment Booked", "Converted"].includes(lead.status)).length}</strong></div>
            <div><span>Qualified Leads</span><strong>${data.filter(lead => lead.status === "Qualified").length}</strong></div>
            <div><span>Conversion Rate</span><strong>${data.length ? Math.round(data.filter(lead => lead.status === "Converted").length / data.length * 100) : 0}%</strong></div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function homeKpi(label, value, delta, helper, tone, icon) {
  const names = { "New Leads": "users", "Follow-ups Due": "clock", "Qualified Leads": "shield", "Pending Leads": "clock" };
  return `<section class="home-kpi card"><div><span>${label}</span><strong>${value}</strong><small>${delta ? `↑ ${delta} ` : ""}<em>${helper}</em></small></div><span class="card-icon ${tone}">${iconSvg(names[label] || "chart",19)}</span></section>`;
}

function renderOverview() {
  const data = visibleLeads();
  const totals = {
    total: data.length,
    new: data.filter((lead) => lead.status === "New Lead").length,
    qualified: data.filter((lead) => lead.status === "Qualified").length,
    booked: data.filter((lead) => lead.status === "Appointment Booked").length,
    overdue: data.filter(isOverdue).length
  };
  return `
    <div class="grid kpis">
      ${kpi("Total Leads", totals.total, "Accepted lead events")}
      ${kpi("New", totals.new, "Need first touch")}
      ${kpi("Qualified", totals.qualified, "Ready for next step")}
      ${kpi("Appointment Booked", totals.booked, "Confirmed slots")}
      ${kpi("Overdue SLA", totals.overdue, "Needs escalation")}
    </div>
    <div class="grid three-col">
      <section class="card pad">
        <h2>Agency Scale</h2>
        <div class="metric-list">
          <div class="metric-row"><span>Client workspaces</span><strong>${clients.length - 1}</strong></div>
          <div class="metric-row"><span>Connected Meta assets</span><strong>${assets.length - 1}</strong></div>
          <div class="metric-row"><span>Client portal users</span><strong>${clientAccess.reduce((sum, item) => sum + item.viewers + 1, 0)}</strong></div>
        </div>
      </section>
      <section class="card pad">
        <h2>Realtime Pipeline</h2>
        <div class="timeline">
          <div class="timeline-item"><strong>Meta webhook</strong><span>2s ack target</span></div>
          <div class="timeline-item"><strong>Queue worker</strong><span>Classify + dedupe</span></div>
          <div class="timeline-item"><strong>Dashboard channel</strong><span>Push updates to client view</span></div>
        </div>
      </section>
      <section class="card pad">
        <h2>Login Policy</h2>
        <p class="notice">Use Meta Login for agency asset connection and dashboard invitations for clients. Do not share Meta passwords; every client user should have their own portal account and audit trail.</p>
      </section>
    </div>
    <div class="grid two-col">
      <section class="card pad">
        <div class="toolbar">
          <h2>Lead Inbox</h2>
          <button class="secondary-btn" type="button" data-jump="Leads">Open inbox</button>
        </div>
        ${leadTable(data.slice(0, 5))}
      </section>
      <section class="card pad">
        <h2>Source and Quality Mix</h2>
        ${mixRow("Lead Form", data.filter((lead) => lead.source === "Lead Form").length, data.length)}
        ${mixRow("Click-to-Message", data.filter((lead) => lead.source === "Click-to-Message").length, data.length)}
        ${mixRow("Engagement", data.filter((lead) => lead.source === "Engagement").length, data.length)}
        ${mixRow("Hot / Warm", data.filter((lead) => ["Hot Lead", "Warm Lead"].includes(lead.quality)).length, data.length)}
      </section>
    </div>
    <div class="grid three-col">
      <section class="card pad">
        <h2>Response Performance</h2>
        <div class="metric-list">
          <div class="metric-row"><span>Visible under 60 seconds</span><strong>99%</strong></div>
          <div class="metric-row"><span>First contact SLA</span><strong>82%</strong></div>
          <div class="metric-row"><span>Idempotent replays</span><strong>100%</strong></div>
        </div>
      </section>
      <section class="card pad">
        <h2>Health</h2>
        <div class="metric-list">
          <div class="metric-row"><span>Webhook queue</span><strong>Clear</strong></div>
          <div class="metric-row"><span>Token expiry</span><strong>28 days</strong></div>
          <div class="metric-row"><span>Failed digests</span><strong>0</strong></div>
        </div>
      </section>
      <section class="card pad">
        <h2>Client-Safe Policy</h2>
        <p class="notice">Client routes use allowlisted lead, source, status, SLA and digest fields. Spend, cost, budget, CPM, CPC, CPL, ROAS and billing keys are blocked.</p>
      </section>
    </div>
  `;
}

function kpi(label, value, helper) {
  return `<section class="card kpi"><span>${label}</span><strong>${value}</strong><em>${helper}</em></section>`;
}

function mixRow(label, value, total) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return `<div class="metric-list"><div><div class="metric-row"><span>${label}</span><strong>${value}</strong></div><div class="bar"><span style="width:${pct}%"></span></div></div></div>`;
}

function renderLeads() {
  const data = visibleLeads();
  return `
    <section class="leads-header">
      <div><p class="eyebrow">Sales workspace</p><h2>Leads</h2><p>Prioritize, contact and move every opportunity forward.</p></div>
      <button class="primary-btn" type="button" id="mockLeadBtnInline">${iconSvg("plus", 16)} Add lead</button>
    </section>
    <section class="lead-kpi-strip" aria-label="Lead status filters">
      ${[["All leads", data.length, "All"], ["New leads", data.filter(l => l.status === "New Lead").length, "All"], ["Follow-up", data.filter(l => l.status === "Follow-up Required").length, "Overdue"], ["Hot leads", data.filter(l => l.quality === "Hot Lead").length, "Hot"], ["Qualified", data.filter(l => l.status === "Qualified").length, "All"]].map(([label,value,filter], index) => `<button type="button" class="lead-kpi ${index === 0 && activeSavedView === "All" ? "active" : ""}" data-saved="${filter}"><span>${label}</span><strong>${value}</strong></button>`).join("")}
    </section>
    <section class="compact-filter-bar card">
      <div class="lead-search">${iconSvg("users", 16)}<input id="leadSearchInline" type="search" value="${state.search}" placeholder="Search name, phone, campaign..." /></div>
      <select aria-label="Account"><option>All accounts</option>${clients.slice(1).map(c => `<option>${c.name}</option>`).join("")}</select>
      <select aria-label="Stage"><option>All stages</option><option>New Lead</option><option>Contacted</option><option>Qualified</option></select>
      <select aria-label="Owner"><option>All owners</option>${users.map(user => `<option>${user}</option>`).join("")}</select>
      <button class="filter-button" type="button" id="advancedFilterBtn">${iconSvg("filter", 16)} Filters <span>2</span></button>
      <button class="icon-action" type="button" title="Export safe CSV" aria-label="Export safe CSV">${iconSvg("list", 17)}</button>
    </section>
    <aside id="advancedFilters" class="advanced-filters card" hidden>
      <div class="drawer-title"><div><h3>Advanced filters</h3><p>Narrow this workspace without crowding the main toolbar.</p></div><button id="closeFilters" class="icon-action" type="button" aria-label="Close filters">×</button></div>
      <div class="form-grid">
        <label>Lead quality<select><option>All quality</option><option>Hot Lead</option><option>Warm Lead</option><option>Cold Lead</option></select></label>
        <label>Follow-up<select><option>Any follow-up</option><option>Due today</option><option>Overdue</option><option>Completed</option></select></label>
        <label>Location<select><option>All locations</option><option>San Francisco</option><option>Austin</option><option>Chicago</option></select></label>
        <label>Source<select><option>All sources</option><option>Lead Form Submission</option><option>WhatsApp Lead</option><option>Engagement Lead</option></select></label>
      </div>
      <div class="drawer-actions"><button class="secondary-btn" type="button">Reset</button><button class="primary-btn" type="button" id="applyFilters">Apply filters</button></div>
    </aside>
    <section class="lead-inbox card">
      <div class="inbox-toolbar"><div><h3>Lead inbox</h3><span>${data.length} leads · Updated just now</span></div><div class="segmented" aria-label="Saved views">${["All", "Overdue", "Hot", "Unassigned"].map(view => `<button type="button" class="${view === activeSavedView ? "active" : ""}" data-saved="${view}">${view}</button>`).join("")}</div></div>
      ${leadTable(data, true)}
    </section>
    <div class="fab-wrap"><div id="fabMenu" class="fab-menu" hidden><button type="button">${iconSvg("users",16)} Add lead</button><button type="button">${iconSvg("list",16)} Import CSV</button><button type="button">${iconSvg("clock",16)} Create follow-up</button><button type="button">${iconSvg("userPlus",16)} Add team member</button></div><button id="fabButton" class="fab" type="button" aria-label="Quick actions">${iconSvg("plus",22)}</button></div>
  `;
}

function leadTable(data, modern = false) {
  if (!data.length) return `<p class="muted">No leads match the current filters.</p>`;
  if (modern) return `<div class="modern-lead-list">${data.map(lead => `
    <article class="modern-lead" data-lead-id="${lead.id}">
      <div class="lead-person"><div class="lead-avatar">${lead.name.split(" ").map(p => p[0]).join("").slice(0,2)}</div><div><button class="lead-name" type="button" data-open-lead="${lead.id}">${lead.name}</button><span>${iconSvg("phone",13)} ${maskContact(lead.phone)}</span><span>${iconSvg("mail",13)} ${maskContact(lead.email)}</span></div></div>
      <div class="lead-context"><strong>${lead.service}</strong><span>${clientName(lead.clientId)} · ${lead.campaign}</span><small>${lead.location} · ${lead.source}</small></div>
      <div class="lead-owner"><span>Owner</span><strong>${lead.owner || "Unassigned"}</strong><small>${timeAgo(lead.due, true)} follow-up</small></div>
      <div class="lead-state">${qualityPill(lead.quality)}<span class="stage-pill">${lead.status}</span></div>
      <div class="lead-quick-actions">${rowActions(lead, "modern")}</div>
    </article>`).join("")}</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Phone</th><th>Email</th><th>Source</th><th>Account</th><th>Campaign</th><th>Category</th><th>Stage</th><th>Owner</th><th>Location</th><th>Follow-up</th><th>Created</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((lead) => `
            <tr data-lead-id="${lead.id}">
              <td data-label="Name"><button class="link-btn" type="button" data-open-lead="${lead.id}">${lead.name}</button><small>${lead.service}</small></td>
              <td data-label="Phone"><span class="phone-cell">${maskContact(lead.phone)} ${rowActions(lead, "phone")}</span></td>
              <td data-label="Email">${maskContact(lead.email)}</td>
              <td data-label="Source">${lead.source}</td>
              <td data-label="Account">${clientName(lead.clientId)}</td>
              <td data-label="Campaign">${lead.campaign}</td>
              <td data-label="Category">${qualityPill(lead.quality)}</td>
              <td data-label="Stage">${lead.status}</td>
              <td data-label="Owner">${lead.owner || "Unassigned"}</td>
              <td data-label="Location">${lead.location}</td>
              <td data-label="Follow-up">${timeAgo(lead.due, true)}</td>
              <td data-label="Created">${timeAgo(lead.received)}</td>
              <td data-label="Actions"><div class="actions">${rowActions(lead, "all")}</div></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function rowActions(lead, mode) {
  const phoneActions = `
    <button class="action-btn whatsapp" type="button" title="Send WhatsApp" data-whatsapp="${lead.id}">WA</button>
    <button class="action-btn" type="button" title="Copy phone" data-copy-phone="${lead.id}">Copy</button>
  `;
  if (mode === "phone") return phoneActions;
  if (mode === "modern") return `
    <button class="quick-action whatsapp-action" type="button" title="WhatsApp" data-whatsapp="${lead.id}">${iconSvg("message",16)}<span>WhatsApp</span></button>
    <button class="quick-action" type="button" title="Call" data-call="${lead.id}">${iconSvg("phone",16)}<span>Call</span></button>
    <button class="quick-action icon-only" type="button" title="Copy phone" data-copy-phone="${lead.id}">${iconSvg("copy",16)}</button>
    <div class="more-wrap"><button class="quick-action icon-only" type="button" title="More actions" data-more="${lead.id}">${iconSvg("more",17)}</button><div class="more-menu" data-menu="${lead.id}" hidden><button data-email="${lead.id}">${iconSvg("mail",15)} Email</button><button data-quick-note="${lead.id}">${iconSvg("note",15)} Add note</button><button data-follow-up="${lead.id}">${iconSvg("clock",15)} Follow-up</button><button>${iconSvg("userPlus",15)} Assign</button><button>${iconSvg("list",15)} Archive</button></div></div>`;
  return `
    ${phoneActions}
    <button class="action-btn" type="button" title="Call" data-call="${lead.id}">Call</button>
    <button class="action-btn" type="button" title="Email" data-email="${lead.id}">Email</button>
    <button class="action-btn" type="button" title="Add note" data-quick-note="${lead.id}">Note</button>
    <button class="action-btn" type="button" title="Schedule follow-up" data-follow-up="${lead.id}">Follow</button>
  `;
}

function qualityPill(quality) {
  return `<span class="pill ${quality.toLowerCase().replaceAll(" ", "-")}">${quality}</span>`;
}

function slaPill(lead) {
  if (["Contacted", "Qualified", "Appointment Booked", "Converted", "Closed", "Invalid Lead"].includes(lead.status)) return `<span class="pill good">Met</span>`;
  return isOverdue(lead) ? `<span class="pill overdue">Overdue</span>` : `<span class="pill due">Due ${timeAgo(lead.due, true)}</span>`;
}

function renderPipeline() {
  const stages = ["New Lead", "Contacted", "Follow-up Required", "Qualified", "Appointment Booked", "Converted", "Closed"];
  const data = visibleLeads();
  return `
    ${sectionHeader("Lead Pipeline", "Drag leads across stages and keep every status change in the activity history.", [
      ["Open stages", stages.length],
      ["Active leads", data.length],
      ["Booked", data.filter((lead) => lead.status === "Appointment Booked").length]
    ])}
    <section class="card pad control-panel">
      <div class="toolbar">
        <h2>Pipeline Controls</h2>
        <div class="segmented"><button class="active" type="button">By stage</button><button type="button">By owner</button><button type="button">By campaign</button></div>
      </div>
      <div class="assignment-rule-row">
        <span>Auto rules active: location routing, service routing, duplicate close-out</span>
        <button class="secondary-btn" type="button" data-jump="Settings">Edit rules</button>
      </div>
    </section>
    <section class="pipeline">
      ${stages.map((stage) => `
        <div class="pipeline-col" data-stage="${stage}">
          <h2>${stage} <span>${data.filter((lead) => normalizeStage(lead.status) === stage).length}</span></h2>
          ${data.filter((lead) => normalizeStage(lead.status) === stage).map((lead) => `
            <article class="lead-card" draggable="true" data-card-lead="${lead.id}">
              <strong>${lead.name}</strong>
              <span>${maskContact(lead.phone)}</span>
              <small>${lead.campaign}</small>
              <small>${lead.location} • ${lead.owner}</small>
              ${qualityPill(lead.quality)}
            </article>
          `).join("") || `<p class="muted">No leads</p>`}
        </div>
      `).join("")}
    </section>
  `;
}

function normalizeStage(status) {
  if (status === "Invalid Lead" || status === "Not Interested" || status === "Duplicate Lead" || status === "Spam") return "Closed";
  return status;
}

function renderFollowUps() {
  const data = visibleLeads();
  const groups = [
    ["Today", data.filter((lead) => !isOverdue(lead) && Date.now() - lead.due.getTime() < 24 * 60 * 60 * 1000)],
    ["Overdue", data.filter(isOverdue)],
    ["Upcoming", data.filter((lead) => lead.due > new Date())],
    ["Completed", data.filter((lead) => ["Contacted", "Appointment Booked", "Converted"].includes(lead.status))]
  ];
  return `
    ${sectionHeader("Follow-up Management", "Track today, overdue, upcoming and completed follow-up work in one place.", [
      ["Due today", groups[0][1].length],
      ["Overdue", groups[1][1].length],
      ["Upcoming", groups[2][1].length]
    ])}
    <div class="grid four-col">
      ${groups.map(([label, items]) => `
        <section class="card pad follow-card">
          <h2>${label}</h2>
          <div class="timeline">
            ${items.slice(0, 5).map((lead) => `<div class="timeline-item"><strong>${lead.name}</strong><span>${lead.followUpType} • ${timeAgo(lead.due, true)} • ${lead.owner}</span></div>`).join("") || `<p class="muted">Nothing here.</p>`}
          </div>
        </section>
      `).join("")}
    </div>
    <section class="card pad">
      <div class="toolbar">
        <h2>Follow-up Queue</h2>
        <button class="primary-btn" type="button">Create follow-up</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Lead</th><th>Phone</th><th>Owner</th><th>Date</th><th>Type</th><th>Stage</th><th>Reminder</th><th>Notes</th></tr></thead>
          <tbody>
            ${data.map((lead) => `<tr><td>${lead.name}</td><td>${maskContact(lead.phone)}</td><td>${lead.owner}</td><td>${lead.due.toLocaleDateString()}</td><td>${lead.followUpType}</td><td>${lead.status}</td><td>${lead.reminder}</td><td>${lead.latestAction}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCampaigns() {
  const data = visibleLeads();
  return `
    ${sectionHeader("Campaigns", "Monitor lead flow by Meta account, campaign, location and form mapping.", [
      ["Campaigns", assets.length - 1],
      ["Mapped clients", clients.length - 1],
      ["Visible leads", data.length]
    ])}
    <div class="grid three-col">
      <section class="card pad"><h2>Top Source</h2><div class="metric-list"><div class="metric-row"><span>Lead Form Submission</span><strong>${data.filter((lead) => lead.source === "Lead Form Submission").length}</strong></div><div class="bar"><span style="width:72%"></span></div></div></section>
      <section class="card pad"><h2>Best Location</h2><div class="metric-list"><div class="metric-row"><span>Austin</span><strong>${data.filter((lead) => lead.location === "Austin").length}</strong></div><div class="bar"><span style="width:58%"></span></div></div></section>
      <section class="card pad"><h2>Routing Health</h2><div class="metric-list"><div class="metric-row"><span>Mapped forms</span><strong>100%</strong></div><div class="bar"><span style="width:100%"></span></div></div></section>
    </div>
    <section class="card pad">
      <div class="toolbar"><h2>Campaigns and Accounts</h2><button class="secondary-btn" type="button">Map campaign</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Campaign</th><th>Client</th><th>Meta source</th><th>Location</th><th>Leads</th><th>Qualified</th><th>Follow-ups</th><th>Budget visibility</th><th>Status</th></tr></thead>
          <tbody>
            ${assets.filter((asset) => asset.id !== "all").map((asset) => {
              const rows = data.filter((lead) => lead.assetId === asset.id);
              return `<tr><td>${asset.name}</td><td>${clientName(asset.clientId)}</td><td>${asset.id}</td><td>${rows[0]?.location || "Multiple"}</td><td>${rows.length}</td><td>${rows.filter((lead) => lead.status === "Qualified").length}</td><td>${rows.filter((lead) => lead.status === "Follow-up Required").length}</td><td>${currentRole().restricted ? "Hidden" : "Admin only"}</td><td><span class="pill good">Active</span></td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderReports() {
  const data = visibleLeads();
  const converted = data.filter((lead) => lead.status === "Converted").length;
  const rate = data.length ? Math.round((converted / data.length) * 100) : 0;
  return `
    ${sectionHeader("Reports", "Simple lead performance reports for agency users and client-safe digests.", [
      ["Response time", "18m"],
      ["Conversion", `${rate}%`],
      ["Digest scan", "Passed"]
    ])}
    <div class="grid kpis">
      ${kpi("Total Leads", data.length, "Selected filters")}
      ${kpi("Contacted", data.filter((lead) => lead.status === "Contacted").length, "Reached at least once")}
      ${kpi("Qualified", data.filter((lead) => lead.status === "Qualified").length, "Sales-ready")}
      ${kpi("Appointments", data.filter((lead) => lead.status === "Appointment Booked").length, "Booked")}
      ${kpi("Conversion Rate", `${rate}%`, "Converted / total")}
    </div>
    <div class="grid two-col">
      <section class="card pad">
        <h2>Lead Performance Digest</h2>
        <div class="metric-list">
          <div class="metric-row"><span>Pending follow-ups</span><strong>${data.filter((lead) => lead.status === "Follow-up Required").length}</strong></div>
          <div class="metric-row"><span>Overdue follow-ups</span><strong>${data.filter(isOverdue).length}</strong></div>
          <div class="metric-row"><span>Invalid leads</span><strong>${data.filter((lead) => lead.status === "Invalid Lead").length}</strong></div>
          <div class="metric-row"><span>Average response time</span><strong>18m</strong></div>
        </div>
      </section>
      <section class="card pad ${currentRole().restricted ? "forbidden" : ""}">
        <h2>Spend Visibility</h2>
        <p>${currentRole().restricted ? "Advertising spend, cost per lead and ROAS are hidden for this role." : "Super Admin can enable or disable spend access per admin user."}</p>
      </section>
    </div>
    <div class="grid two-col">
      <section class="card pad">
        <h2>Lead Stage Breakdown</h2>
        ${["New Lead", "Contacted", "Follow-up Required", "Qualified", "Appointment Booked", "Converted"].map((stage) => mixRow(stage, data.filter((lead) => lead.status === stage).length, Math.max(data.length, 1))).join("")}
      </section>
      <section class="card pad">
        <h2>Client Digest Preview</h2>
        <article class="digest-preview">
          <p>Total leads, contacted leads, qualified leads, booked appointments, converted leads, pending follow-ups, campaign-wise count and response performance.</p>
          <p class="notice">Client digest excludes spend, cost per lead, ROAS, credentials, internal comments and hidden user performance.</p>
        </article>
      </section>
    </div>
  `;
}

function timeAgo(date, future = false) {
  const diff = future ? date.getTime() - Date.now() : Date.now() - date.getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return future ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

function renderAccounts() {
  const tokenTone = metaConnection.connected ? "good" : "due";
  return `
    ${sectionHeader("Meta Accounts", "Connect Meta businesses, ad accounts, pages, Instagram profiles and lead forms.", [
      ["Businesses", metaConnection.connected ? 4 : 0],
      ["Mapped assets", assets.length - 1],
      ["Token health", metaConnection.connected ? "Good" : "Setup needed"]
    ])}
    <div class="grid two-col">
      <section class="card pad">
        <div class="toolbar">
          <h2>Connected Meta Assets</h2>
          <div class="toolbar-actions">
            ${metaConnection.connected ? '<button class="secondary-btn" type="button" id="syncMetaLeadsNow">Sync Leads Now</button>' : ""}
            <button class="primary-btn" type="button" id="connectMetaInline">${metaConnection.connected ? "Manage Meta Login" : "Connect Meta Login"}</button>
          </div>
        </div>
        <p class="muted">One agency workspace can connect many Meta businesses, ad accounts, Pages and forms, then map each source to exactly one client portal.</p>
        <div class="mapping-list">
          ${assets.filter((asset) => asset.id !== "all").map((asset) => `
            <div class="mapping-item">
              <div><strong>${asset.name}</strong><br><span class="muted">${asset.id}</span></div>
              <span class="pill good">${clientName(asset.clientId)}</span>
            </div>
          `).join("")}
        </div>
      </section>
      <section class="card pad">
        <h2>Token and Sync Health</h2>
        <div class="metric-list">
          <div class="metric-row"><span>Business connection</span><strong>${metaConnection.business}</strong></div>
          <div class="metric-row"><span>Token status</span><strong><span class="pill ${tokenTone}">${metaConnection.tokenStatus}</span></strong></div>
          <div class="metric-row"><span>Last sync</span><strong>${metaConnection.lastSync}</strong></div>
          <div class="metric-row"><span>Asset mapping guard</span><strong>Enabled</strong></div>
          <div class="metric-row"><span>Connected accounts</span><strong>${assets.length - 1}</strong></div>
        </div>
        <p class="notice">Each mapped asset can belong to exactly one client in the local MVP.</p>
      </section>
    </div>
    <div class="grid three-col">
      <section class="card pad"><h2>Connection Steps</h2><div class="timeline"><div class="timeline-item"><strong>1. Meta Login</strong><span>OAuth connection for agency owner.</span></div><div class="timeline-item"><strong>2. Select assets</strong><span>Choose business, pages, forms and Instagram sources.</span></div><div class="timeline-item"><strong>3. Map to client</strong><span>Every source maps to one client workspace.</span></div></div></section>
      <section class="card pad"><h2>Webhook Status</h2><div class="metric-list"><div class="metric-row"><span>Lead Ads webhook</span><strong>Subscribed</strong></div><div class="metric-row"><span>Replay protection</span><strong>On</strong></div><div class="metric-row"><span>Last event</span><strong>1m ago</strong></div></div></section>
      <section class="card pad"><h2>Data Separation</h2><p class="notice">Users only see assigned accounts, locations, campaigns and clients. Client users never see agency assets, tokens or other clients.</p></section>
    </div>
  `;
}

function renderIntegrations() {
  return `
    ${sectionHeader("WhatsApp Templates", "Create reusable message templates for fast lead communication.", [
      ["Templates", 6],
      ["Used today", 18],
      ["Approval", "Internal"]
    ])}
    <div class="grid two-col">
      <section class="card pad">
        <div class="toolbar"><h2>Template Library</h2><button class="primary-btn" type="button">New template</button></div>
        <div class="timeline">
          <div class="timeline-item"><strong>Initial Contact</strong><span>Hi {{lead_name}}, thank you for contacting us regarding {{service_name}}.</span></div>
          <div class="timeline-item"><strong>Follow-up Reminder</strong><span>Hi {{lead_name}}, checking a suitable time to connect.</span></div>
          <div class="timeline-item"><strong>Appointment Confirmation</strong><span>Your appointment for {{service_name}} at {{location}} is confirmed.</span></div>
          <div class="timeline-item"><strong>Unreachable</strong><span>We tried reaching you about {{campaign_name}}. Please reply with a suitable time.</span></div>
        </div>
      </section>
      <section class="card pad">
        <h2>Template Builder</h2>
        <div class="form-grid">
          <label>Template name<input value="Initial Contact" /></label>
          <label>Category<select><option>Lead response</option><option>Follow-up</option><option>Appointment</option></select></label>
          <label class="full">Message<textarea>Hi {{lead_name}}, thank you for contacting us regarding {{service_name}}. Our team would be happy to assist you.</textarea></label>
          <label>Variable<select><option>{{lead_name}}</option><option>{{campaign_name}}</option><option>{{service_name}}</option><option>{{location}}</option><option>{{assigned_user}}</option><option>{{follow_up_date}}</option></select></label>
          <label>Status<select><option>Active</option><option>Draft</option><option>Paused</option></select></label>
        </div>
      </section>
    </div>
    <div class="grid two-col">
      <section class="card pad">
        <h2>Connected Tools</h2>
        <div class="metric-list">
          <div class="metric-row"><span>Meta Login</span><strong>Ready</strong></div>
          <div class="metric-row"><span>WhatsApp Web</span><strong>One-click open</strong></div>
          <div class="metric-row"><span>Email digests</span><strong>Preview mode</strong></div>
          <div class="metric-row"><span>Realtime channel</span><strong>Simulated</strong></div>
        </div>
      </section>
      <section class="card pad">
        <h2>Usage Rules</h2>
        <div class="timeline"><div class="timeline-item"><strong>Manual send</strong><span>Team chooses template before opening WhatsApp.</span></div><div class="timeline-item"><strong>Activity logging</strong><span>Every WhatsApp action is saved to the lead timeline.</span></div><div class="timeline-item"><strong>Phase 3</strong><span>Official WhatsApp API and automation can be added later.</span></div></div>
      </section>
    </div>
  `;
}

function renderAdmin() {
  return `
    ${sectionHeader("Settings", "Configure CRM roles, buckets, automation, branding, exports and security.", [
      ["Roles", 5],
      ["Buckets", 13],
      ["Rules", 3]
    ])}
    <div class="grid two-col">
      <section class="card pad">
        <h2>Admin Panel</h2>
        <div class="admin-grid">
          ${["User management", "Role management", "Permission management", "Client management", "Meta account management", "Campaign mapping", "Lead stage configuration", "Lead bucket configuration", "WhatsApp templates", "Follow-up rules", "Email digests", "Audit logs", "Branding settings"].map((item) => `<button class="nav-card compact" type="button"><strong>${item}</strong><span>Configure</span></button>`).join("")}
        </div>
      </section>
      <section class="card pad">
        <h2>Lead Buckets</h2>
        <div class="bucket-list">
          ${["New Lead", "Contacted", "Follow-up Required", "Qualified", "Appointment Booked", "Converted", "Not Interested", "Invalid Lead", "Duplicate Lead", "Unreachable", "Out of Location", "Spam", "Closed"].map((bucket) => `<span class="pill">${bucket}</span>`).join("")}
        </div>
        <h2 style="margin-top:18px">Assignment Rules</h2>
        <div class="timeline">
          <div class="timeline-item"><strong>Location rule</strong><span>Gurugram leads go to Gurugram sales team.</span></div>
          <div class="timeline-item"><strong>Service rule</strong><span>Specialty services route to department owners.</span></div>
          <div class="timeline-item"><strong>Round robin</strong><span>Distribute unassigned leads across active team members.</span></div>
        </div>
      </section>
    </div>
    <div class="grid three-col">
      <section class="card pad"><h2>Permission Matrix</h2><div class="timeline"><div class="timeline-item"><strong>Super Admin</strong><span>All data, spend controls and account setup.</span></div><div class="timeline-item"><strong>Admin</strong><span>Assigned accounts, leads, reports and team users.</span></div><div class="timeline-item"><strong>Client User</strong><span>Own business leads only, no spend or internal notes.</span></div></div></section>
      <section class="card pad"><h2>Branding</h2><div class="form-grid"><label>Workspace name<input value="MetaLeads" /></label><label>Primary color<input value="#0f6bff" /></label><label class="full">Portal domain<input value="clients.metaleads.local" /></label></div></section>
      <section class="card pad forbidden"><h2>Spend Controls</h2><p>Spend, cost per lead and ROAS are hidden unless Super Admin enables access. Client users are always blocked.</p></section>
    </div>
  `;
}

function renderAccess() {
  return `
    <div class="grid two-col">
      <section class="card pad">
        <div class="toolbar">
          <h2>Client Portal Access</h2>
          <button class="primary-btn" type="button" id="inviteClientBtn">Invite client</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Admin email</th><th>Users</th><th>Status</th><th>Auth</th></tr></thead>
            <tbody>
              ${clientAccess.map((access) => `
                <tr>
                  <td data-label="Client">${clientName(access.clientId)}</td>
                  <td data-label="Admin email">${access.admin}</td>
                  <td data-label="Users">${access.viewers + 1}</td>
                  <td data-label="Status"><span class="pill ${access.status === "Active" ? "good" : "due"}">${access.status}</span></td>
                  <td data-label="Auth">${access.auth}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="card pad">
        <h2>Credential Policy</h2>
        <div class="timeline">
          <div class="timeline-item"><strong>Agency Meta Login</strong><span>Connect businesses and pages through OAuth permissions.</span></div>
          <div class="timeline-item"><strong>Client dashboard login</strong><span>Email invite, password or magic link, optional MFA.</span></div>
          <div class="timeline-item"><strong>No shared passwords</strong><span>Every login has role, client scope and audit events.</span></div>
          <div class="timeline-item"><strong>Emergency access</strong><span>Rotate credentials and revoke sessions from Team.</span></div>
        </div>
        <p class="notice">Clients should receive a dashboard URL plus their own login. They should never need your Meta Business password.</p>
      </section>
    </div>
    <section class="card pad">
      <h2>Real-Time Sharing Flow</h2>
      <div class="flow">
        <div><strong>Meta Lead Event</strong><span>Webhook or polling fallback</span></div>
        <div><strong>MongoDB Write</strong><span>Tenant + client scoped document</span></div>
        <div><strong>Server Push</strong><span>Socket/SSE channel per client</span></div>
        <div><strong>Client Dashboard</strong><span>Lead appears without refresh</span></div>
      </div>
    </section>
  `;
}

function renderRules() {
  return `
    <div class="grid two-col">
      <section class="card pad">
        <h2>Rules and SLA Test Mode</h2>
        <div class="form-grid">
          <label>Event origin<select id="ruleOrigin"><option>Leadgen webhook/form submission</option><option>Messaging origin</option><option>Post/ad interaction</option></select></label>
          <label>Intent<select id="ruleIntent"><option>Appointment/Consultation</option><option>Service enquiry</option><option>General engagement</option><option>Spam/Test</option></select></label>
          <label class="full">Contact completeness<select id="ruleContact"><option>Phone and email</option><option>Phone only</option><option>Missing usable contact</option></select></label>
        </div>
        <div id="ruleResult" class="notice" style="margin-top:12px"></div>
      </section>
      <section class="card pad">
        <h2>Active Defaults</h2>
        <div class="timeline">
          <div class="timeline-item"><strong>Leadgen webhook</strong><span>Acquisition: Lead Form</span></div>
          <div class="timeline-item"><strong>Appointment or callback</strong><span>Quality: Hot</span></div>
          <div class="timeline-item"><strong>Complete service enquiry</strong><span>Quality: Warm</span></div>
          <div class="timeline-item"><strong>Spam, test or duplicate</strong><span>Quality: Invalid</span></div>
        </div>
      </section>
    </div>
  `;
}

function renderDigests() {
  const data = visibleLeads();
  const overdue = data.filter(isOverdue);
  return `
    <div class="grid two-col">
      <section class="card pad">
        <div class="toolbar">
          <h2>Reviewable Digest Preview</h2>
          <button class="primary-btn" type="button" id="approveDigest">Approve test send</button>
        </div>
        <article class="digest-preview">
          <p class="eyebrow">${clientName(state.clientId === "all" ? "northstar" : state.clientId)} • Daily summary</p>
          <h2>Lead response snapshot</h2>
          <ul>
            <li>${data.length} leads accepted in the selected window.</li>
            <li>${data.filter((lead) => lead.quality === "Hot Lead").length} hot leads need priority review.</li>
            <li>${overdue.length} leads are overdue against first-contact SLA.</li>
            <li>${data.filter((lead) => lead.status === "Appointment Booked").length} appointments were booked.</li>
          </ul>
          <p class="notice">This digest contains no spend or cost-derived metrics.</p>
        </article>
      </section>
      <section class="card pad">
        <h2>Send Log</h2>
        <div class="timeline">
          <div class="timeline-item"><strong>Preview generated</strong><span>2m ago</span></div>
          <div class="timeline-item"><strong>Forbidden-field scan</strong><span>Passed</span></div>
          <div class="timeline-item"><strong>Test email adapter</strong><span>Ready</span></div>
        </div>
      </section>
    </div>
  `;
}

function renderClients() {
  return `
    <div class="grid three-col">
      ${clients.filter((client) => client.id !== "all").map((client) => {
        const count = leads.filter((lead) => lead.clientId === client.id).length;
        return `<section class="card pad"><h2>${client.name}</h2><div class="metric-list"><div class="metric-row"><span>Leads</span><strong>${count}</strong></div><div class="metric-row"><span>Mapped assets</span><strong>${assets.filter((asset) => asset.clientId === client.id).length}</strong></div><div class="metric-row"><span>Portal</span><strong>Safe</strong></div></div></section>`;
      }).join("")}
    </div>
  `;
}

function renderTeam() {
  return `
    ${sectionHeader("Team Management", "Manage internal users, client users, permissions, assignment queues and spend access.", [
      ["Internal users", users.length],
      ["Client users", clientAccess.reduce((sum, item) => sum + item.viewers + 1, 0)],
      ["MFA", "Ready"]
    ])}
    <div class="grid three-col">
      <section class="card pad"><h2>Invite User</h2><div class="form-grid"><label>Name<input placeholder="Full name" /></label><label>Email<input placeholder="name@company.com" /></label><label>Role<select><option>Admin</option><option>Team Member</option><option>Client User</option><option>Client Viewer</option></select></label><label>Client / account<select>${clients.filter((client) => client.id !== "all").map((client) => `<option>${client.name}</option>`).join("")}</select></label></div><button class="primary-btn" type="button" style="margin-top:12px">Send invite</button></section>
      <section class="card pad"><h2>Assignment Queues</h2><div class="timeline"><div class="timeline-item"><strong>Gurugram sales</strong><span>Location routing for regional leads.</span></div><div class="timeline-item"><strong>Ortho team</strong><span>Service-based routing for knee replacement leads.</span></div><div class="timeline-item"><strong>Round robin</strong><span>Distribute uncategorized leads evenly.</span></div></div></section>
      <section class="card pad"><h2>Access Summary</h2><div class="metric-list"><div class="metric-row"><span>Spend-enabled admins</span><strong>1</strong></div><div class="metric-row"><span>Suspended users</span><strong>0</strong></div><div class="metric-row"><span>Pending invites</span><strong>3</strong></div></div></section>
    </div>
    <section class="card pad">
      <div class="toolbar"><h2>Team and Permissions</h2><button class="secondary-btn" type="button">Export users</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Role</th><th>Assigned access</th><th>Location</th><th>Status</th><th>Spend policy</th><th>Last active</th></tr></thead>
          <tbody>
            <tr><td>Maya Chen</td><td>Admin</td><td>Assigned clients and digest approval</td><td>All locations</td><td><span class="pill good">Active</span></td><td>Blocked by default</td><td>8m ago</td></tr>
            <tr><td>Arjun Mehta</td><td>Team Member</td><td>Assigned leads and contact outcomes</td><td>San Jose</td><td><span class="pill good">Active</span></td><td>Never</td><td>14m ago</td></tr>
            <tr><td>Riya Kapoor</td><td>Team Member</td><td>Follow-up queue and calls</td><td>Austin</td><td><span class="pill good">Active</span></td><td>Never</td><td>31m ago</td></tr>
            <tr><td>Northstar Client</td><td>Client User</td><td>Northstar Dental portal</td><td>Client scoped</td><td><span class="pill good">Active</span></td><td>Never</td><td>1h ago</td></tr>
            <tr><td>Evergreen Viewer</td><td>Client Viewer</td><td>Digest archive only</td><td>Client scoped</td><td><span class="pill due">Pending</span></td><td>Never</td><td>Invite sent</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAudit() {
  return `
    <section class="card pad">
      <h2>Audit and Health Log</h2>
      <div class="timeline">
        ${audit.map((item, index) => `<div class="timeline-item"><strong>${item}</strong><span>${index + 1} event${index ? "s" : ""} ago</span></div>`).join("")}
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <div class="grid two-col">
      <section class="card pad">
        <h2>Security Controls</h2>
        <div class="timeline">
          <div class="timeline-item"><strong>Tenant scoping</strong><span>organization_id and client_id required</span></div>
          <div class="timeline-item"><strong>PII redaction</strong><span>Restricted roles see masked contact data</span></div>
          <div class="timeline-item"><strong>Webhook replay protection</strong><span>provider_event_id unique</span></div>
        </div>
      </section>
      <section class="card pad forbidden">
        <h2>Spend Vocabulary Block</h2>
        <p>The client-safe surface rejects spend, cost, budget, CPM, CPC, CPL, ROAS and billing fields across routes, exports, digests and logs.</p>
      </section>
      <section class="card pad">
        <h2>MongoDB SaaS Model</h2>
        <div class="timeline">
          <div class="timeline-item"><strong>organizations</strong><span>Agency tenant, plan, settings and owner.</span></div>
          <div class="timeline-item"><strong>clients</strong><span>Client workspace, portal settings and safe export policy.</span></div>
          <div class="timeline-item"><strong>metaConnections</strong><span>Encrypted OAuth tokens and connected business metadata.</span></div>
          <div class="timeline-item"><strong>leads</strong><span>organizationId, clientId, sourceEventId, status, owner and SLA timestamps.</span></div>
          <div class="timeline-item"><strong>auditEvents</strong><span>Immutable access, export, assignment and digest records.</span></div>
        </div>
      </section>
      <section class="card pad">
        <h2>Production Stack</h2>
        <div class="metric-list">
          <div class="metric-row"><span>Database</span><strong>MongoDB Atlas</strong></div>
          <div class="metric-row"><span>Realtime</span><strong>Socket.IO or SSE</strong></div>
          <div class="metric-row"><span>Auth</span><strong>Dashboard login + Meta OAuth</strong></div>
          <div class="metric-row"><span>Backend</span><strong>Next.js API / Node workers</strong></div>
        </div>
      </section>
    </div>
  `;
}

function bindDynamicEvents() {
  document.querySelectorAll("[data-lead-id]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openLead(row.dataset.leadId);
    });
  });
  document.querySelectorAll("[data-open-lead]").forEach((button) => {
    button.addEventListener("click", () => openLead(button.dataset.openLead));
  });
  document.querySelectorAll("[data-copy-phone]").forEach((button) => {
    button.addEventListener("click", () => copyPhone(button.dataset.copyPhone));
  });
  document.querySelectorAll("[data-whatsapp]").forEach((button) => {
    button.addEventListener("click", () => sendWhatsApp(button.dataset.whatsapp));
  });
  document.querySelectorAll("[data-call]").forEach((button) => {
    button.addEventListener("click", () => callLead(button.dataset.call));
  });
  document.querySelectorAll("[data-email]").forEach((button) => {
    button.addEventListener("click", () => emailLead(button.dataset.email));
  });
  document.querySelectorAll("[data-quick-note]").forEach((button) => {
    button.addEventListener("click", () => quickNote(button.dataset.quickNote));
  });
  document.querySelectorAll("[data-follow-up]").forEach((button) => {
    button.addEventListener("click", () => quickFollowUp(button.dataset.followUp));
  });
  const inlineLead = $("#mockLeadBtnInline");
  if (inlineLead) inlineLead.addEventListener("click", ingestMockLead);
  document.querySelectorAll("[data-card-lead]").forEach((card) => {
    card.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", card.dataset.cardLead));
  });
  document.querySelectorAll("[data-stage]").forEach((column) => {
    column.addEventListener("dragover", (event) => event.preventDefault());
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      moveLeadStage(event.dataTransfer.getData("text/plain"), column.dataset.stage);
    });
  });
  document.querySelectorAll("[data-saved]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSavedView = button.dataset.saved;
      render();
    });
  });
  const inlineSearch = $("#leadSearchInline");
  if (inlineSearch) inlineSearch.addEventListener("input", (event) => {
    state.search = event.target.value;
    window.clearTimeout(window.leadSearchTimer);
    window.leadSearchTimer = window.setTimeout(render, 180);
  });
  const advancedButton = $("#advancedFilterBtn");
  const advancedDrawer = $("#advancedFilters");
  if (advancedButton && advancedDrawer) advancedButton.addEventListener("click", () => { advancedDrawer.hidden = false; });
  if ($("#closeFilters")) $("#closeFilters").addEventListener("click", () => { advancedDrawer.hidden = true; });
  if ($("#applyFilters")) $("#applyFilters").addEventListener("click", () => { advancedDrawer.hidden = true; showToast("Filters applied"); });
  document.querySelectorAll("[data-more]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = document.querySelector(`[data-menu="${button.dataset.more}"]`);
    document.querySelectorAll(".more-menu").forEach((item) => { if (item !== menu) item.hidden = true; });
    menu.hidden = !menu.hidden;
  }));
  const fabButton = $("#fabButton");
  if (fabButton) fabButton.addEventListener("click", () => { const menu = $("#fabMenu"); menu.hidden = !menu.hidden; });
  document.querySelectorAll("[data-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.jump;
      render();
    });
  });
  ["ruleOrigin", "ruleIntent", "ruleContact"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", updateRuleResult);
  });
  updateRuleResult();
  const approve = $("#approveDigest");
  if (approve) {
    approve.addEventListener("click", () => {
      audit.unshift("Digest test send approved and logged");
      activeView = "Audit Log";
      render();
    });
  }
  const connect = $("#connectMetaInline");
  if (connect) connect.addEventListener("click", connectMeta);
  const syncNow = $("#syncMetaLeadsNow");
  if (syncNow) syncNow.addEventListener("click", syncMetaLeadsNow);
  const launchOAuth = $("#launchMetaOAuth");
  if (launchOAuth) launchOAuth.addEventListener("click", launchMetaOAuth);
  const demoMeta = $("#demoMetaConnect");
  if (demoMeta) demoMeta.addEventListener("click", completeDemoMetaConnection);
  const invite = $("#inviteClientBtn");
  if (invite) invite.addEventListener("click", inviteClient);
}

function updateRuleResult() {
  const result = $("#ruleResult");
  if (!result) return;
  const origin = $("#ruleOrigin").value;
  const intent = $("#ruleIntent").value;
  const contact = $("#ruleContact").value;
  const acquisition = origin.includes("Messaging") ? "Click-to-Message" : origin.includes("Post") ? "Engagement" : "Lead Form";
  let quality = intent.includes("Spam") || contact.includes("Missing") ? "Invalid Lead" : intent.includes("Appointment") ? "Hot Lead" : intent.includes("Service") ? "Warm Lead" : "Cold Lead";
  result.textContent = `Predicted result: ${acquisition}, ${quality}, confidence ${quality === "Invalid" ? "92" : "84"}%. Reason will be written to classification history before activation.`;
}

function openLead(id) {
  const lead = leads.find((item) => item.id === id);
  if (!lead) return;
  state.selectedLeadId = id;
  const panel = $("#detailPanel");
  panel.innerHTML = `
    <div class="panel-header modern-panel-header">
      <div>
        <p class="eyebrow">${lead.id} • ${clientName(lead.clientId)}</p>
        <h2>${lead.name}</h2>${qualityPill(lead.quality)}
        <p class="muted">${lead.service} · ${lead.status}</p>
      </div>
      <button class="icon-btn" type="button" id="closePanel" aria-label="Close detail">×</button>
    </div>
    <div class="stack">
      <section class="drawer-contact-actions">
        <button type="button" data-call="${lead.id}">${iconSvg("phone",18)}<span>Call</span></button>
        <button type="button" class="whatsapp-action" data-whatsapp="${lead.id}">${iconSvg("message",18)}<span>WhatsApp</span></button>
        <button type="button" data-email="${lead.id}">${iconSvg("mail",18)}<span>Email</span></button>
      </section>
      <section class="drawer-summary">
        <div><span>Phone</span><strong>${maskContact(lead.phone)}</strong></div><div><span>Email</span><strong>${maskContact(lead.email)}</strong></div><div><span>Campaign</span><strong>${lead.campaign}</strong></div><div><span>Owner</span><strong>${lead.owner}</strong></div>
      </section>
      <section class="card pad">
        <h3>Activity timeline</h3>
        <div class="timeline modern-timeline"><div class="timeline-item"><strong>Lead received</strong><span>${timeAgo(lead.received)}</span></div><div class="timeline-item"><strong>${lead.latestAction}</strong><span>Recent activity</span></div>${lead.notes.map(note => `<div class="timeline-item"><strong>${note}</strong><span>System</span></div>`).join("")}</div>
      </section>
      <section class="card pad">
        <h3>Update Lead</h3>
        <div class="form-grid">
          <label>Status<select id="detailStatus">${["New Lead", "Contacted", "Follow-up Required", "Qualified", "Appointment Booked", "Converted", "Not Interested", "Invalid Lead", "Duplicate Lead", "Unreachable", "Out of Location", "Spam", "Closed"].map((status) => `<option ${lead.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
          <label>Owner<select id="detailOwner">${users.map((user) => `<option ${lead.owner === user ? "selected" : ""}>${user}</option>`).join("")}</select></label>
          <label class="full">Note<textarea id="detailNote" placeholder="Add a reason or next action"></textarea></label>
        </div>
        <button class="primary-btn" type="button" id="saveLead" style="margin-top:12px">Save update</button>
      </section>
    </div>
  `;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  $("#closePanel").addEventListener("click", closeLead);
  $("#saveLead").addEventListener("click", saveLeadUpdate);
  bindPanelContactActions(lead.id);
}

function bindPanelContactActions(id) {
  const panel = $("#detailPanel");
  panel.querySelector("[data-call]")?.addEventListener("click", () => callLead(id));
  panel.querySelector("[data-whatsapp]")?.addEventListener("click", () => sendWhatsApp(id));
  panel.querySelector("[data-email]")?.addEventListener("click", () => emailLead(id));
}

function hydrateStaticIcons() {
  document.querySelectorAll("[data-static-icon]").forEach((element) => {
    element.innerHTML = iconSvg(element.dataset.staticIcon, 17);
  });
}

async function saveLeadUpdate() {
  const lead = leads.find((item) => item.id === state.selectedLeadId);
  if (!lead) return;
  const status = $("#detailStatus").value;
  const owner = $("#detailOwner").value;
  const note = $("#detailNote").value.trim();
  try {
    const result = await api(`/leads/${lead.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, owner, notes: note ? [note, ...lead.notes] : lead.notes })
    });
    const updated = normalizeApiLead(result.lead);
    leads = leads.map(item => item.id === updated.id ? updated : item);
    audit.unshift(`${updated.name} updated to ${updated.status}`);
    closeLead();
    render();
  } catch (error) {
    showToast(error.message || "Lead update failed");
  }
}

function closeLead() {
  const panel = $("#detailPanel");
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
}

function ingestMockLead() {
  showToast("Connect Meta or use POST /api/leads to add real data");
}

function findLead(id) {
  return leads.find((lead) => lead.id === id);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

async function copyPhone(id) {
  const lead = findLead(id);
  if (!lead) return;
  try {
    await navigator.clipboard.writeText(lead.phone);
    showToast("Phone number copied");
  } catch {
    showToast(lead.phone);
  }
  audit.unshift(`Phone copied for ${lead.name}`);
}

function sendWhatsApp(id) {
  const lead = findLead(id);
  if (!lead) return;
  lead.status = "Contacted";
  lead.latestAction = "WhatsApp initiated";
  audit.unshift(`WhatsApp message sent to ${lead.name}`);
  const message = encodeURIComponent(`Hi ${lead.name}, thank you for contacting us regarding ${lead.service}. Our team would be happy to assist you. Please let us know a suitable time to connect.`);
  window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}?text=${message}`, "_blank");
  showToast("WhatsApp opened with template");
  render();
}

function callLead(id) {
  const lead = findLead(id);
  if (!lead) return;
  audit.unshift(`Call attempted for ${lead.name}`);
  window.location.href = `tel:${lead.phone.replaceAll(" ", "")}`;
  showToast(`Calling ${lead.phone}`);
}

function emailLead(id) {
  const lead = findLead(id);
  if (!lead) return;
  audit.unshift(`Email action opened for ${lead.name}`);
  window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(lead.service + " enquiry")}`;
  showToast("Email composer opened");
}

function quickNote(id) {
  const lead = findLead(id);
  if (!lead) return;
  lead.notes.unshift("Quick note added from CRM table");
  lead.latestAction = "Note added";
  audit.unshift(`Note added for ${lead.name}`);
  showToast("Note added");
  render();
}

function quickFollowUp(id) {
  const lead = findLead(id);
  if (!lead) return;
  lead.status = "Follow-up Required";
  lead.due = new Date(Date.now() + 24 * 60 * 60 * 1000);
  lead.followUpType = "Phone call";
  lead.latestAction = "Follow-up scheduled";
  audit.unshift(`Follow-up scheduled for ${lead.name}`);
  showToast("Follow-up scheduled");
  render();
}

function moveLeadStage(id, stage) {
  const lead = findLead(id);
  if (!lead) return;
  lead.status = stage;
  lead.latestAction = `Moved to ${stage}`;
  audit.unshift(`${lead.name} moved to ${stage}`);
  showToast("Stage updated");
  render();
}

function connectMeta() {
  openMetaConnectionPanel();
}

function openMetaConnectionPanel() {
  const panel = $("#detailPanel");
  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Meta OAuth setup</p>
        <h2>Connect Meta Login</h2>
        <p class="muted">Use your Meta app credentials to connect lead forms, Pages, Instagram accounts and ad accounts.</p>
      </div>
      <button class="icon-btn" type="button" id="closePanel" aria-label="Close detail">×</button>
    </div>
    <div class="stack">
      <section class="card pad">
        <h3>Connection Status</h3>
        <div class="metric-list">
          <div class="metric-row"><span>Status</span><strong>${metaConnection.connected ? "Connected" : "Not connected"}</strong></div>
          <div class="metric-row"><span>Business</span><strong>${metaConnection.business}</strong></div>
          <div class="metric-row"><span>Last sync</span><strong>${metaConnection.lastSync}</strong></div>
        </div>
      </section>
      <section class="card pad">
        <h3>Meta App Setup</h3>
        <p class="notice">Meta App credentials and access tokens are read from backend environment variables. They are never exposed to browser JavaScript.</p>
        <div class="form-grid">
          <label>Meta App ID<input id="metaAppId" value="Configured on server" readonly /></label>
          <label>Redirect URI<input id="metaRedirectUri" value="https://crm.genesisvirtue.com/api/auth/meta/callback" /></label>
          <label class="full">Required scopes<input value="pages_show_list, pages_read_engagement, pages_manage_metadata, leads_retrieval, business_management, ads_read" readonly /></label>
        </div>
        <div class="bulk-bar" style="margin-top:12px">
          <span>For local demo, use the demo connect button. For production, enter your App ID and launch OAuth.</span>
          <button class="secondary-btn" type="button" id="demoMetaConnect">Use demo connection</button>
          <button class="primary-btn" type="button" id="launchMetaOAuth">Launch Meta OAuth</button>
        </div>
      </section>
      <section class="card pad">
        <h3>Backend .env Template</h3>
        <div class="env-box">
<pre>META_APP_ID=your_meta_app_id
META_APP_SECRET=your_regenerated_app_secret
META_BUSINESS_ID=your_business_id
META_VERIFY_TOKEN=your_private_verify_token
META_ACCESS_TOKEN=system_user_token_with_page_access
META_PAGE_ID=selected_page_id
META_AD_ACCOUNT_ID=selected_ad_account_id</pre>
        </div>
        <p class="forbidden mini-warning">If an App Secret or token was shared in chat, screenshots, frontend code, GitHub, or logs, regenerate it in Meta Developers before production use.</p>
      </section>
      <section class="card pad">
        <h3>Production Checklist</h3>
        <div class="timeline">
          <div class="timeline-item"><strong>Meta Developer App</strong><span>Add valid OAuth redirect URI and Lead Ads product.</span></div>
          <div class="timeline-item"><strong>Permissions</strong><span>Request pages_show_list, pages_read_engagement, pages_manage_metadata, leads_retrieval, business_management and ads_read.</span></div>
          <div class="timeline-item"><strong>Webhook</strong><span>Configure callback URL, verify token and leadgen subscription.</span></div>
          <div class="timeline-item"><strong>Token storage</strong><span>Store encrypted long-lived tokens server-side, never in browser storage.</span></div>
        </div>
      </section>
    </div>
  `;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  $("#closePanel").addEventListener("click", closeLead);
  $("#launchMetaOAuth").addEventListener("click", launchMetaOAuth);
  $("#demoMetaConnect").addEventListener("click", completeDemoMetaConnection);
}

function launchMetaOAuth() {
  audit.unshift("Meta OAuth launched for agency workspace");
  window.location.assign(`${API_BASE}/auth/meta/start`);
}

function completeDemoMetaConnection() {
  metaConnection = {
    connected: true,
    appId: $("#metaAppId")?.value.trim() || "demo-app-id",
    business: "Agency Meta Business",
    tokenStatus: "Connected",
    lastSync: "Just now"
  };
  audit.unshift("Demo Meta Login connected for Agency Meta Business");
  $("#healthPill").textContent = "Meta connected";
  showToast("Meta Login connected");
  closeLead();
  activeView = "Meta Accounts";
  render();
}

function inviteClient() {
  clientAccess.unshift({
    clientId: "pinnacle",
    admin: "client@pinnaclelegal.example",
    viewers: 1,
    status: "Pending",
    auth: "Invite sent"
  });
  audit.unshift("Client portal invite created for Pinnacle Legal");
  render();
}

function exportSafeCsv() {
  const forbidden = ["spend", "cost", "budget", "cpm", "cpc", "cpl", "roas", "billing"];
  const rows = visibleLeads().map((lead) => ({
    id: lead.id,
    received: lead.received.toISOString(),
    name: lead.name,
    contact: maskContact(lead.email),
    client: clientName(lead.clientId),
    source: lead.source,
    quality: lead.quality,
    status: lead.status,
    owner: lead.owner,
    sla: isOverdue(lead) ? "overdue" : "met_or_due"
  }));
  const keys = Object.keys(rows[0] || {});
  const blocked = keys.some((key) => forbidden.some((word) => key.toLowerCase().includes(word)));
  if (blocked) throw new Error("Forbidden spend field detected");
  return [keys.join(","), ...rows.map((row) => keys.map((key) => `"${String(row[key]).replaceAll('"', '""')}"`).join(","))].join("\n");
}

function closeMobileSidebar() {
  $("#appShell").classList.remove("sidebar-open");
  $("#sidebarBackdrop").hidden = true;
}

$("#sidebarToggle").addEventListener("click", () => {
  const isOpen = $("#appShell").classList.toggle("sidebar-open");
  $("#sidebarBackdrop").hidden = !isOpen;
});
$("#sidebarBackdrop").addEventListener("click", closeMobileSidebar);

document.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-view]");
  if (navButton) {
    activeView = navButton.dataset.view;
    render();
    closeMobileSidebar();
  }
  if (!event.target.closest(".more-wrap")) document.querySelectorAll(".more-menu").forEach((menu) => { menu.hidden = true; });
});

document.addEventListener("keydown", (event) => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (event.key === "/" && !typing && activeView === "Leads") {
    event.preventDefault();
    $("#leadSearchInline")?.focus();
  }
  if (event.key.toLowerCase() === "n" && !typing && activeView === "Leads") ingestMockLead();
  if (event.key === "Escape") {
    closeLead();
    if ($("#advancedFilters")) $("#advancedFilters").hidden = true;
    if ($("#fabMenu")) $("#fabMenu").hidden = true;
    document.querySelectorAll(".more-menu").forEach((menu) => { menu.hidden = true; });
  }
});

$("#roleSelect").addEventListener("change", (event) => {
  state.role = event.target.value;
  if (currentRole().clientLocked) state.clientId = "northstar";
  closeLead();
  render();
});

$("#clientFilter").addEventListener("change", (event) => {
  state.clientId = event.target.value;
  state.assetId = "all";
  render();
});

$("#assetFilter").addEventListener("change", (event) => {
  state.assetId = event.target.value;
  render();
});

$("#rangeFilter").addEventListener("change", (event) => {
  state.range = Number(event.target.value);
  render();
});

$("#globalSearch").addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

$("#mockLeadBtn").addEventListener("click", ingestMockLead);
$("#metaConnectBtn").addEventListener("click", connectMeta);
$("#authForm").addEventListener("submit", submitAuth);
$("#authModeToggle").addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));
$("#logoutBtn").addEventListener("click", logout);
$("#passwordToggle").addEventListener("click", () => {
  const input = $("#authPassword");
  input.type = input.type === "password" ? "text" : "password";
  $("#passwordToggle").setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
});
document.querySelectorAll("[data-social]").forEach((button) => button.addEventListener("click", () => showToast(`${button.dataset.social} sign-in requires backend OAuth setup`)));

window.metaLeadsApp = { exportSafeCsv, visibleLeads };

setAuthMode("login");
hydrateStaticIcons();
if (new URLSearchParams(window.location.search).get("meta") === "connected") {
  window.history.replaceState({}, "", window.location.pathname);
  showToast("Meta account connected");
}
restoreSession();
