/**
 * Role-based access control. The rules are data in rbac.config.js; this file only reads them.
 * Every request gets req.access = { role, permissions } (see auth.js identify()), and each route says
 * what it needs with requirePermission("area:action").
 */
import * as defaults from "./rbac.config.js";

/** Signed-out visitors: not a role anyone is given, just the GUEST permissions in rbac.config.js. */
export const GUEST_ROLE = "guest";

/** guest plus the real roles, so `inherits: "guest"` and ["guest"] in COMPONENTS work. */
const viewsOf = ({ GUEST, ROLES }) => ({ [GUEST_ROLE]: GUEST, ...ROLES });

/** Problems in an rbac config, as readable strings. Empty when it is fine. */
export function configErrors(config) {
  const { PERMISSIONS, COMPONENTS, NEW_USER_ROLE, OWNER_ROLE } = config;
  const ROLES = viewsOf(config);
  const errors = [];
  if (GUEST_ROLE in config.ROLES) errors.push(`"${GUEST_ROLE}" is not a role; set what signed-out visitors see in GUEST`);
  const known = (permission) => permission === "*" || permission in PERMISSIONS;
  for (const [name, role] of Object.entries(ROLES)) {
    if (role.inherits !== undefined && !(role.inherits in ROLES)) {
      errors.push(`role "${name}" inherits unknown role "${role.inherits}"`);
    }
    for (const permission of role.can ?? []) {
      if (!known(permission)) errors.push(`role "${name}" has unknown permission "${permission}"`);
    }
    const seen = new Set();
    for (let current = name; current !== undefined; current = ROLES[current]?.inherits) {
      if (seen.has(current)) {
        errors.push(`role "${name}" inherits from itself`);
        break;
      }
      seen.add(current);
    }
  }
  for (const [label, role] of Object.entries({ NEW_USER_ROLE, OWNER_ROLE })) {
    if (!(role in config.ROLES)) errors.push(`${label} "${role}" is not in ROLES`);
  }
  for (const [id, rule] of Object.entries(COMPONENTS)) {
    if (Array.isArray(rule)) {
      for (const role of rule) if (!(role in ROLES)) errors.push(`component "${id}" lists unknown role "${role}"`);
    } else if (!(rule in PERMISSIONS)) {
      errors.push(`component "${id}" needs unknown permission "${rule}"`);
    }
  }
  return errors;
}

/** role name (and "guest") -> Set of permissions, with `inherits` and "*" expanded. */
export function buildRolePermissions(config) {
  const all = Object.keys(config.PERMISSIONS);
  const ROLES = viewsOf(config);
  const resolve = (name) => {
    const role = ROLES[name];
    const own = role.can ?? [];
    const inherited = role.inherits === undefined ? [] : resolve(role.inherits);
    return own.includes("*") ? all : [...inherited, ...own];
  };
  return new Map(Object.keys(ROLES).map((name) => [name, new Set(resolve(name))]));
}

const errors = configErrors(defaults);
if (errors.length) throw new Error(`rbac.config.js is invalid:\n  ${errors.join("\n  ")}`);

const rolePermissions = buildRolePermissions(defaults);

export const { NEW_USER_ROLE, OWNER_ROLE } = defaults;
export const ALL_PERMISSIONS = Object.keys(defaults.PERMISSIONS);
/** Roles a user can be given, in config order. */
export const ASSIGNABLE_ROLES = Object.keys(defaults.ROLES);
/** Roles that can change roles. The last user holding one of these cannot be demoted. */
export const MANAGER_ROLES = ASSIGNABLE_ROLES.filter((name) => rolePermissions.get(name).has("users:manage"));

export function permissionsFor(role) {
  return rolePermissions.get(role) ?? new Set();
}

/**
 * What a request may do.
 *  - sign-in on, signed out: the guest role;
 *  - sign-in on, signed in: the user's role;
 *  - sign-in off: everything (role null), unless DEV_ROLE asks to preview one role.
 */
export function accessFor({ authEnabled, user = null, devRole = null }) {
  if (!authEnabled) {
    return devRole ? { role: devRole, permissions: permissionsFor(devRole) } : { role: null, permissions: new Set(ALL_PERMISSIONS) };
  }
  const role = user ? user.role : GUEST_ROLE;
  return { role, permissions: permissionsFor(role) };
}

/** { componentId: true/false } for every id in COMPONENTS. */
export function visibleComponents(access, components = defaults.COMPONENTS) {
  return Object.fromEntries(
    Object.entries(components).map(([id, rule]) => [
      id,
      Array.isArray(rule) ? access.role === null || rule.includes(access.role) : access.permissions.has(rule),
    ]),
  );
}

/** The body of GET /auth/me (minus the user). */
export function describeAccess(access) {
  return {
    role: access.role,
    permissions: ALL_PERMISSIONS.filter((permission) => access.permissions.has(permission)),
    components: visibleComponents(access),
  };
}

/**
 * Route guard: app.get("/x", requirePermission("x:view"), handler). 401 for guests (signing in may
 * help), 403 for a signed-in role without the permission.
 */
export function requirePermission(permission) {
  if (!ALL_PERMISSIONS.includes(permission)) throw new Error(`unknown permission "${permission}"`);
  const guard = (req, res, next) => {
    const access = req.access;
    if (access?.permissions.has(permission)) return next();
    if (!access || access.role === GUEST_ROLE) return res.status(401).json({ error: "sign in required" });
    res.status(403).json({ error: `the ${access.role} role cannot do this (needs ${permission})` });
  };
  guard.permission = permission;
  return guard;
}

/** Makes sure every role in rbac.config.js has a row in the roles table (run after migrations). */
export async function syncRoles(db) {
  await db.query(
    "insert into roles (role_name) select unnest($1::text[]) on conflict (role_name) do nothing",
    [ASSIGNABLE_ROLES],
  );
}

export function rolesSummary() {
  return Object.entries(viewsOf(defaults)).map(([name, role]) => ({
    name,
    label: role.label,
    description: role.description,
    assignable: name !== GUEST_ROLE,
    permissions: ALL_PERMISSIONS.filter((permission) => permissionsFor(name).has(permission)),
  }));
}
