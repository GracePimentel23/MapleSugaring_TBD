/**
 * WHO SEES WHAT, AND WHO CAN CHANGE WHAT. This is the one file to edit for roles.
 *
 * Ported from worker/src/rbac.config.js on the RBAC-SYSTEM branch (merged into main), with the
 * same permission ids and shape, so the two stay easy to line up when the front end moves onto
 * the worker. Permissions marked "redesign" are new: they cover features the worker does not
 * have yet (maintenance mode, the schedule, thresholds, seasons...).
 *
 *   1. PERMISSIONS  every thing a person can see or do.
 *   2. GUEST        what anyone sees without signing in. Not a role: it is having no role.
 *      ROLES        the three roles a signed-in person can have: member, manager, owner.
 *   3. COMPONENTS   every page, card and button wrapped in <ShowFor id="...">, and who sees it.
 *
 * In the demo there is no server, so these rules decide what the screen shows. Pick a view with
 * "View as" (profile menu, or the demo bar). Owners can also change grants from
 * Settings > Users & Roles > Edit Permissions while the app is running.
 */

// ---- 1. PERMISSIONS -------------------------------------------------------------------------------
// "area:action". ":view" means reading; anything else changes data.
export const PERMISSIONS = {
  "dashboard:view": "See the dashboard and season totals",
  "stations:view": "See station cards and their open alerts",
  "stations:manage": "Add stations, edit bucket name, location, target weight and tare",
  "stations:maintenance": "Turn maintenance mode on and off", // redesign
  "alerts:view": "See the alert list",
  "alerts:resolve": "Acknowledge and resolve alerts",
  "collections:view": "See collection logs",
  "collections:log": "Log a collection (empty buckets)",
  "collections:edit": "Edit or delete a logged collection",
  "batches:view": "See boiling batches",
  "batches:manage": "Start, update and finish batches",
  "batches:editClosed": "Override the lock on a closed batch", // redesign
  "schedule:view": "See the work schedule", // redesign
  "schedule:join": "Sign up for jobs and finish your own", // redesign
  "schedule:manage": "Post jobs and assign others", // redesign
  "sensors:view": "See raw readings, LoRa packets, nodes and gateways",
  "account:edit": "Edit your own name, email and pronouns", // redesign
  "settings:view": "Open Settings: notifications, units and seasons", // redesign
  "seasons:manage": "Edit season dates and close a season", // redesign
  "thresholds:manage": "Change alert thresholds", // redesign
  "data:export": "Export CSV and PDF reports", // redesign
  "data:delete": "Delete data permanently", // redesign
  "users:manage": "See everyone who signed in and change their role",
  "roles:manage": "Change what each role is allowed to do", // redesign
  "audit:view": "See the history of role changes",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ---- 2. GUEST AND ROLES ------------------------------------------------------------------------------
// `inherits` copies another role's permissions (or the guest's); `can` adds more. ["*"] means everything.

/** The roles a signed-in person can have, in the order an owner sees them in a picker. */
export type Role = "member" | "manager" | "owner";
/** Guest plus the signed-in roles: everything "View as" can pick. */
export type View = "guest" | Role;

export interface RoleDef {
  label: string;
  description: string;
  inherits?: View;
  can: (Permission | "*")[];
}

/** Anyone just looking at the website, not signed in. Nobody is given this; it is the lack of a role. */
export const GUEST: RoleDef = {
  label: "Guest",
  description: "Not signed in. The public view of today's sap activity.",
  can: ["dashboard:view", "stations:view"],
};

// The order here is the order an owner sees in a role picker.
export const ROLES: Record<Role, RoleDef> = {
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
    // "Owner" in the worker config; the redesign calls this account "Owner / IT".
    label: "Owner / IT",
    description: "Club lead or teacher. Everything, including who has which role.",
    can: ["*"],
  },
};

/** Everyone's role on their first sign-in, until an owner changes it. */
export const NEW_USER_ROLE: Role = "member";
/** Only the owner holds these; they cannot be granted to other roles from Settings. */
export const OWNER_ONLY: Permission[] = ["roles:manage", "thresholds:manage", "data:delete"];

// ---- 3. COMPONENTS -----------------------------------------------------------------------------------
// id -> who sees it: a permission (preferred, so it follows the roles above) or a list of views,
// where "guest" means signed out, e.g. ["guest"] for a "sign in to see more" note.
// Use the id in the app: <ShowFor id="dashboard.nextSteps">...</ShowFor>.
export const COMPONENTS: Record<string, Permission | View[]> = {
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
  "alerts.maintenance": "stations:maintenance", // Extend 1 Hour / end maintenance

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
