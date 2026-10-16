/**
 * Role-based access control. The rules are data in rbac.config.ts; this file only reads them.
 * Mirrors worker/src/rbac.js: `inherits` and "*" are expanded once, up front.
 */
import {
  COMPONENTS,
  GUEST,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
  type RoleDef,
  type View,
} from "@/lib/rbac.config";

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
export const VIEWS: View[] = ["guest", ...(Object.keys(ROLES) as Role[])];

const defs: Record<View, RoleDef> = { guest: GUEST, ...ROLES };

export const viewLabels = Object.fromEntries(
  VIEWS.map((view) => [view, defs[view].label]),
) as Record<View, string>;

export const viewDescriptions = Object.fromEntries(
  VIEWS.map((view) => [view, defs[view].description]),
) as Record<View, string>;

/** Problems in the config, as readable strings. Empty when it is fine. */
export function configErrors(): string[] {
  const errors: string[] = [];
  for (const [name, def] of Object.entries(defs)) {
    if (def.inherits !== undefined && !(def.inherits in defs)) {
      errors.push(`"${name}" inherits unknown view "${def.inherits}"`);
    }
  }
  for (const [id, rule] of Object.entries(COMPONENTS)) {
    if (Array.isArray(rule)) {
      for (const view of rule) if (!(view in defs)) errors.push(`component "${id}" lists unknown view "${view}"`);
    } else if (!(rule in PERMISSIONS)) {
      errors.push(`component "${id}" needs unknown permission "${rule}"`);
    }
  }
  return errors;
}

/** view -> every permission it has, with `inherits` and "*" expanded. */
export function defaultGrants(): Record<View, Permission[]> {
  const resolve = (view: View, seen: Set<View> = new Set()): Permission[] => {
    if (seen.has(view)) return [];
    seen.add(view);
    const def = defs[view];
    if (def.can.includes("*")) return [...ALL_PERMISSIONS];
    const inherited = def.inherits ? resolve(def.inherits, seen) : [];
    return [...new Set([...inherited, ...(def.can as Permission[])])];
  };
  return Object.fromEntries(VIEWS.map((view) => [view, resolve(view)])) as Record<View, Permission[]>;
}

/** Whether `view`, holding `permissions`, may see component `id`. Unknown ids are hidden. */
export function componentVisible(id: string, view: View, permissions: ReadonlySet<Permission>): boolean {
  const rule = COMPONENTS[id];
  if (rule === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`ShowFor: "${id}" is not in COMPONENTS in lib/rbac.config.ts, so it is hidden`);
    }
    return false;
  }
  return Array.isArray(rule) ? rule.includes(view) : permissions.has(rule);
}

const errors = configErrors();
if (errors.length) throw new Error(`rbac.config.ts is invalid:\n  ${errors.join("\n  ")}`);
