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
  "stations:maintenance": "Turn maintenance mode on and off",
  "alerts:view": "See the alert list",
  "alerts:resolve": "Acknowledge and resolve alerts",
  "collections:view": "See collection logs",
  "collections:log": "Log a collection (empty buckets)",
  "collections:edit": "Edit or delete a logged collection",
  "batches:view": "See boiling batches",
  "batches:manage": "Start, update and finish batches",
  "batches:editClosed": "Override the lock on a closed batch",
  "schedule:view": "See the work schedule",
  "schedule:join": "Sign up for jobs and finish your own",
  "schedule:manage": "Post jobs and assign others",
  "sensors:view": "See raw readings, LoRa packets, nodes and gateways",
  "account:edit": "Edit your own name and pronouns",
  "settings:view": "Open Settings: notifications, units and seasons",
  "seasons:manage": "Edit season dates and close a season",
  "thresholds:manage": "Change alert thresholds",
  "data:export": "Export CSV reports",
  "users:manage": "See everyone who signed in and change their role",
  "audit:view": "See the history of changes",
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
    can: [
      "alerts:view",
      "collections:view",
      "batches:view",
      "collections:log",
      "alerts:resolve",
      "schedule:view",
      "schedule:join",
      "account:edit",
    ],
  },
  manager: {
    label: "Manager",
    description: "Runs the season: stations, batches, fixing logged collections, raw sensor data.",
    inherits: "member",
    can: [
      "stations:manage",
      "collections:edit",
      "batches:manage",
      "sensors:view",
      "stations:maintenance",
      "schedule:manage",
      "seasons:manage",
      "data:export",
      "settings:view",
    ],
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
  // Header
  "header.alerts": "alerts:view", // the bell, its count, and the notifications panel

  // Navigation (sidebar and phone tab bar). A page whose nav item is hidden shows "Sign in".
  "nav.dashboard": "dashboard:view",
  "nav.stations": "stations:view",
  "nav.schedule": "schedule:view",
  "nav.alerts": "alerts:view",
  "nav.data": "collections:view",
  "nav.settings": "settings:view",
  "nav.account": "account:edit", // /account, from the profile menu
  "nav.demo": "demo:use", // temporary Demo tab

  // Dashboard page (/)
  "dashboard.summary": "dashboard:view", // sap today, syrup, weather cards
  "dashboard.stations": "stations:view", // station tiles
  "dashboard.nextSteps": "alerts:view", // Next Steps checklist
  "dashboard.signIn": ["guest"], // "sign in to do more" note

  // Stations page (/stations) and the station pop-up
  "stations.manage": "stations:manage", // "Add Station", "Edit Station"
  "stations.maintenance": "stations:maintenance", // the maintenance toggle
  "stations.logCollection": "collections:log", // "Log Collection"
  "stations.alerts": "alerts:view", // the alert lines in the pop-up

  // Alerts page (/alerts)
  "alerts.respond": "alerts:resolve", // Acknowledge / Resolve
  "alerts.maintenance": "stations:maintenance", // end maintenance

  // Schedule page (/schedule)
  "schedule.join": "schedule:join", // Sign Up, Leave, I'll Do It, Mark Done on own jobs
  "schedule.manage": "schedule:manage", // Assign, Remove, Post for Sign-Up

  // Data pages: tabs, then the buttons inside them
  "data.overview": "collections:view",
  "data.collections": "collections:view",
  "data.collections.add": "collections:log",
  "data.collections.edit": "collections:edit",
  "data.batches": "batches:view",
  "data.batches.manage": "batches:manage",
  "data.batches.editClosed": "batches:editClosed",
  "data.analysis": "collections:view",
  "data.export": "data:export",

  // Settings tabs
  "settings.thresholds": "sensors:view",
  "settings.users": "users:manage",
  "settings.trees": "sensors:view",
  "settings.notifications": "settings:view",
  "settings.units": "settings:view",
  "settings.seasons": "seasons:manage",
  "settings.audit": "audit:view",
  "settings.display": "settings:view",
};
