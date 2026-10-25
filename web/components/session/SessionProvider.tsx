"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Access } from "@/lib/api/server";
import { sendJson } from "@/lib/api/client";
import type { Member, Role, View } from "@/lib/data/people";

export interface AuditEntry {
  id: number;
  /** "3/11, 9:40 AM" */
  when: string;
  /** ISO timestamp, for filtering */
  at: string;
  user: string;
  action: string;
  record: string;
  change: string;
}

interface ApiUser {
  id: number;
  email: string;
  name: string;
  pronouns: string | null;
  role: Role;
  last_login_at: string | null;
}

interface ApiAuditRow {
  id: number;
  at: string;
  actor: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  record: string | null;
  change: string | null;
  before: { role?: string } | null;
  after: { role?: string } | null;
}

/** With sign-in off and no "View as" picked, the worker allows everything; this is that view. */
export const ALL_VIEW = "all";

/** "3/11, 9:40 AM" in the club's time zone */
function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function auditEntry(row: ApiAuditRow): AuditEntry {
  const roleChange = row.action === "role_change";
  return {
    id: row.id,
    when: stamp(row.at),
    at: row.at,
    user: row.actor ?? "System",
    action: roleChange ? "Changed role" : row.action,
    record: row.record ?? `${row.entity} ${row.entity_id ?? ""}`.trim(),
    change: row.change ?? (roleChange ? `${row.before?.role ?? "none"} to ${row.after?.role ?? "?"}` : ""),
  };
}

/**
 * How people sign in:
 *  - "sso": the worker has sign-in on (AUTH_PROVIDER=google), so the login page sends people through
 *    RIT's Google sign-in and the role comes from the worker;
 *  - "demo": no worker, or sign-in is off, so the login page offers "View as" one role at a time.
 */
export type AuthMode = "sso" | "demo";

interface SessionValue {
  authMode: AuthMode;
  /** Send the browser to the worker's Google sign-in; it comes back to `returnTo` signed in. */
  startSignIn: (returnTo?: string) => void;
  /** End the session (on the worker too, with sign-in on) and drop to the guest view. */
  signOut: () => Promise<void>;
  /** The worker answered GET /auth/me. When false, nothing is enforced and everything shows. */
  connected: boolean;
  /** Google sign-in is on (otherwise "View as" picks a view for testing) */
  authEnabled: boolean;
  /** Who is looking: "guest" (signed out), a role, or "all" (sign-in off, no limits) */
  view: View;
  signedIn: boolean;
  /** The signed-in account, or a stand-in named after the view */
  user: Member;
  /** Everyone who has signed in (only for roles that may manage users) */
  members: Member[];
  /** Change a member's role (PATCH /users/:id). Resolves to whether it worked. */
  updateMember: (member: Member) => Promise<boolean>;
  /** Sign in or out; with sign-in off, preview a view ("View as"). */
  viewAs: (view: View) => void;
  /** Login page: open the app at `goTo` as `view` (with sign-in on, only "guest" applies: signs out). */
  enterAs: (view: View, goTo?: string) => Promise<void>;
  /** What "View as" offers, or null with sign-in on */
  viewChoices: View[] | null;
  /** guest, then the roles, in config order */
  views: View[];
  viewLabels: Record<View, string>;
  viewDescriptions: Record<View, string>;
  /** Roles a person can be given, in config order */
  roles: Role[];
  /** Every permission each view holds (from worker/src/rbac.config.js) */
  grants: Record<View, string[]>;
  permissionLabels: Record<string, string>;
  can: (permission: string) => boolean;
  /** Whether component `id` in worker/src/rbac.config.js COMPONENTS shows for this view */
  shows: (id: string) => boolean;
  /** Settings > Audit Log (GET /audit) */
  audit: AuditEntry[];
  /** Re-read members and the audit log */
  reload: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export default function SessionProvider({ access, children }: { access: Access | null; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [reloads, setReloads] = useState(0);

  const roleList = useMemo(() => access?.roles ?? [], [access]);
  const views = useMemo(() => roleList.map((role) => role.name), [roleList]);
  const viewLabels = useMemo<Record<string, string>>(
    () => ({ [ALL_VIEW]: "Everything", ...Object.fromEntries(roleList.map((role) => [role.name, role.label])) }),
    [roleList],
  );
  const viewDescriptions = useMemo<Record<string, string>>(
    () => ({
      [ALL_VIEW]: "Sign-in is off: every page and button, no limits.",
      ...Object.fromEntries(roleList.map((role) => [role.name, role.description])),
    }),
    [roleList],
  );
  const grants = useMemo(() => Object.fromEntries(roleList.map((role) => [role.name, role.permissions])), [roleList]);

  const view: View = access?.role ?? ALL_VIEW;
  const signedIn = access === null || (access.authEnabled ? access.user !== null : view !== "guest");
  const user = useMemo<Member>(() => {
    if (access?.user) {
      return {
        id: access.user.id,
        name: access.user.name,
        email: access.user.email,
        role: access.user.role,
        pronouns: access.user.pronouns ?? undefined,
        status: "active",
        activity: [],
      };
    }
    // Sign-in off: a stand-in so "logged by" and notes still carry a name.
    const label = view === ALL_VIEW ? "Tester" : `${viewLabels[view] ?? view} (testing)`;
    return { id: 0, name: view === "guest" ? "Guest" : label, email: "", role: view, status: "active", activity: [] };
  }, [access, view, viewLabels]);

  const permissions = useMemo(() => new Set(access?.permissions ?? []), [access]);
  const can = useCallback((permission: string) => access === null || permissions.has(permission), [access, permissions]);
  const shows = useCallback(
    (id: string) => {
      if (access === null) return true;
      const visible = access.components[id];
      if (visible === undefined && process.env.NODE_ENV !== "production") {
        console.warn(`ShowFor: "${id}" is not in COMPONENTS in worker/src/rbac.config.js, so it is hidden`);
      }
      return visible === true;
    },
    [access],
  );

  const canManageUsers = can("users:manage") && access !== null;
  const canAudit = can("audit:view") && access !== null;
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [users, rows] = await Promise.all([
        canManageUsers ? fetch("/api/users").then((r) => (r.ok ? r.json() : [])) : Promise.resolve([]),
        canAudit ? fetch("/api/audit").then((r) => (r.ok ? r.json() : [])) : Promise.resolve([]),
      ]).catch(() => [[], []] as [ApiUser[], ApiAuditRow[]]);
      if (cancelled) return;
      setMembers(
        (users as ApiUser[]).map((item) => ({
          id: item.id,
          name: item.name,
          email: item.email,
          role: item.role,
          pronouns: item.pronouns ?? undefined,
          status: "active",
          activity: item.last_login_at ? [{ when: stamp(item.last_login_at), what: "Signed in" }] : [],
        })),
      );
      setAudit((rows as ApiAuditRow[]).map(auditEntry));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [canManageUsers, canAudit, reloads]);

  const reload = useCallback(() => setReloads((count) => count + 1), []);

  const updateMember = useCallback(
    async (member: Member) => {
      try {
        await sendJson("PATCH", `/users/${member.id}`, { role: member.role });
        reload();
        router.refresh();
        return true;
      } catch (error) {
        window.alert((error as Error).message);
        return false;
      }
    },
    [reload, router],
  );

  const viewAs = useCallback(
    (next: View) => {
      if (access?.authEnabled) {
        if (next === "guest") {
          void sendJson("POST", "/auth/logout").finally(() => router.refresh());
        } else {
          // A full page load: the API's sign-in route redirects to Google and back.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(pathname)}`;
        }
        return;
      }
      document.cookie = `tbd_view_as=${encodeURIComponent(next)}; path=/; SameSite=Lax`;
      router.refresh();
    },
    [access, pathname, router],
  );

  const enterAs = useCallback(
    async (next: View, goTo = "/") => {
      if (access?.authEnabled) {
        await sendJson("POST", "/auth/logout").catch(() => null);
      } else {
        document.cookie = `tbd_view_as=${encodeURIComponent(next)}; path=/; SameSite=Lax`;
      }
      // A full page load with no router.refresh() first: Safari drops a pending navigation when the
      // router rewrites history, which left iPhones on the login page.
      window.location.assign(goTo);
    },
    [access],
  );

  const authMode: AuthMode = access?.authEnabled ? "sso" : "demo";

  const startSignIn = useCallback((returnTo = "/") => {
    // A full page load on purpose: /api/auth/google is the worker's redirect to Google, not a page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  const signOut = useCallback(async () => {
    if (access?.authEnabled) {
      await sendJson("POST", "/auth/logout").catch(() => null);
    } else {
      document.cookie = "tbd_view_as=guest; path=/; SameSite=Lax";
    }
    router.refresh();
  }, [access, router]);

  const value = useMemo<SessionValue>(
    () => ({
      authMode,
      startSignIn,
      signOut,
      connected: access !== null,
      authEnabled: access?.authEnabled ?? false,
      view,
      signedIn,
      user,
      // Without the users list (sign-in off, or a role that cannot read it), pickers still have you.
      members: members.length || !signedIn ? members : [user],
      updateMember,
      viewAs,
      enterAs,
      viewChoices: access?.viewAs ?? null,
      views,
      viewLabels,
      viewDescriptions,
      roles: roleList.filter((role) => role.assignable).map((role) => role.name),
      grants,
      permissionLabels: access?.permissionLabels ?? {},
      can,
      shows,
      audit,
      reload,
    }),
    [authMode, startSignIn, signOut, access, view, signedIn, user, members, updateMember, viewAs, enterAs, views, viewLabels, viewDescriptions, roleList, grants, can, shows, audit, reload],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
