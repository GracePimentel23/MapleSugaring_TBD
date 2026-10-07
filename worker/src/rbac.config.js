/**
 * WHO SEES WHAT, AND WHO CAN CHANGE WHAT. This is the one file to edit for roles.
 *
 *   1. PERMISSIONS  every thing a person can see or do. The worker checks these on every API route.
 *   2. GUEST        what anyone sees without signing in. Not a role: it is having no role.
 *      ROLES        the three roles a signed-in person can have: member, manager, owner.
 *   3. COMPONENTS   every page, card and button the web app wraps in <ShowFor id="...">, and who sees it.
 *
 * The web app never hard-codes roles: it asks GET /api/auth/me, which answers from this file.
 * Save the file and restart `npm run dev`; no database change is needed (new roles are added on boot).
 * How-to: docs/RBAC.md.
 */

// ---- 1. PERMISSIONS -------------------------------------------------------------------------------
// "area:action". ":view" means reading; anything else changes data and is enforced by the worker.
export const PERMISSIONS = {
  "dashboard:view": "See the dashboard and season totals",
  "stations:view": "See station cards and their open alerts",
  "stations:manage": "Add stations, edit bucket name, location, target weight and tare",
  "alerts:view": "See the alert list",
  "alerts:resolve": "Mark an alert resolved",
  "collections:view": "See collection logs",
  "collections:log": "Log a collection (empty buckets)",
  "collections:edit": "Edit or delete a logged collection",
  "batches:view": "See boiling batches",
  "batches:manage": "Start, update and finish batches",
  "sensors:view": "See raw readings, LoRa packets, nodes and gateways",
  "users:manage": "See everyone who signed in and change their role",
  "audit:view": "See the history of role changes",
  "gateways:manage": "Make and revoke the keys gateway bridges use to send readings",
  "demo:use": "Use the temporary Demo tab: tare, modes, reset history, clear alerts, calibration",
};

// ---- 2. GUEST AND ROLES ------------------------------------------------------------------------------
// `inherits` copies another role's permissions (or the guest's); `can` adds more. ["*"] means everything.

/** Anyone just looking at the website, not signed in. Nobody is given this; it is the lack of a role. */
export const GUEST = {
  label: "Guest",
  description: "Not signed in. The public view of today's sap activity.",
  // demo:use is temporary (sponsor video): remove it here to hide the Demo tab from signed-out visitors.
  can: ["dashboard:view", "stations:view", "demo:use"],
};

// The order here is the order an owner sees in a role picker.
export const ROLES = {
  member: {
    label: "Member",
    description: "Signed in club member. Sees everything, logs collections and handles alerts.",
    inherits: "guest",
    can: ["alerts:view", "collections:view", "batches:view", "collections:log", "alerts:resolve"],
  },
  manager: {
    label: "Manager",
    description: "Runs the season: stations, batches, fixing logged collections, raw sensor data.",
    inherits: "member",
    can: ["stations:manage", "collections:edit", "batches:manage", "sensors:view"],
  },
  owner: {
    label: "Owner",
    description: "Club lead or teacher. Everything, including who has which role.",
    can: ["*"],
  },
};

/** Everyone's role on their first sign-in, until an owner changes it. */
export const NEW_USER_ROLE = "member";
/** Given to ADMIN_EMAILS on every sign-in. */
export const OWNER_ROLE = "owner";

// ---- 3. COMPONENTS -----------------------------------------------------------------------------------
// id -> who sees it: a permission (preferred, so it follows the roles above) or a list of roles,
// where "guest" means signed out, e.g. ["guest"] for a "sign in to see more" note.
// Use the id in the web app: <ShowFor id="dashboard.sapChart">...</ShowFor>. Hiding a button is only
// cosmetic; the worker still refuses the action unless the role has the permission.
export const COMPONENTS = {
  // Navigation (sidebar and phone tab bar)
  "nav.dashboard": "dashboard:view",
  "nav.stations": "stations:view",
  "nav.data": "collections:view",
  "nav.settings": "users:manage",
  "nav.demo": "demo:use", // temporary Demo tab

  // Dashboard page (/)
  "dashboard.conditions": "dashboard:view", // weather and sap-condition cards
  "dashboard.production": "dashboard:view", // sap collected / processed / syrup produced
  "dashboard.sapChart": "dashboard:view", // weekly sap collected chart
  "dashboard.stations": "stations:view", // station list on the right

  // Stations page (/stations)
  "stations.manage": "stations:manage", // "Add station" and the edit pencil on each card

  // Data page (/data): tabs, then the buttons inside them
  "data.overview": "collections:view",
  "data.collections": "collections:view",
  "data.collections.add": "collections:log",
  "data.collections.edit": "collections:edit",
  "data.batches": "batches:view",
  "data.batches.manage": "batches:manage",
  "data.analysis": "collections:view",
};
