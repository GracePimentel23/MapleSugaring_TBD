"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoAccountForRole, seedMembers, type Member } from "@/lib/data/people";
import { componentVisible, defaultGrants } from "@/lib/rbac";
import { VIEWS } from "@/lib/rbac";
import type { Permission, Role, View } from "@/lib/rbac.config";

export interface AuditEntry {
  id: number;
  /** "3/11, 9:40 AM" */
  when: string;
  user: string;
  action: string;
  record: string;
  change: string;
}

/** History from before the demo window, so the log is not empty on day one. */
const seedAudit: AuditEntry[] = [
  {
    id: 4,
    when: "2/28, 4:12 PM",
    user: "Dana K.",
    action: "Changed threshold",
    record: "Sap age, warn",
    change: "20 h to 24 h",
  },
  {
    id: 3,
    when: "2/28, 3:50 PM",
    user: "Grace P.",
    action: "Added tree",
    record: "Bucket #05",
    change: "West Field, tree 1",
  },
  {
    id: 2,
    when: "2/27, 11:05 AM",
    user: "Dana K.",
    action: "Started season",
    record: "Season 2022",
    change: "2/28 to 3/14",
  },
  { id: 1, when: "2/27, 10:40 AM", user: "Dana K.", action: "Invited member", record: "Alex R.", change: "Member" },
];

/** Stands in for "nobody" while viewing as a guest, so screens never have to null-check. */
const GUEST_USER: Member = {
  id: 0,
  name: "Guest",
  email: "",
  role: "member",
  status: "active",
  activity: [],
};

/**
 * How people sign in:
 *  - "checking": asking the worker (first moment after load);
 *  - "sso": the worker has sign-in on (AUTH_PROVIDER=google), so the login page sends people through
 *    RIT's Google sign-in and the role comes from the worker;
 *  - "demo": no worker, or sign-in is off, so the login page offers one demo account per role.
 */
export type AuthMode = "checking" | "sso" | "demo";

/** GET /api/auth/me on the worker (main: worker/src/auth.js). */
interface AuthMe {
  authEnabled: boolean;
  user: { id: number; email: string; name: string; role: string } | null;
  role: string | null;
}

/** Signed-in accounts get ids above the demo members', so the two never collide. */
const SSO_ID_OFFSET = 100_000;

interface SessionValue {
  authMode: AuthMode;
  /** Send the browser to the worker's Google sign-in; it comes back to `returnTo` signed in. */
  startSignIn: (returnTo?: string) => void;
  /** End the session (on the worker too, with sign-in on) and drop to the guest view. */
  signOut: () => Promise<void>;
  /** Who is looking: "guest" (signed out) or a role */
  view: View;
  signedIn: boolean;
  /** The signed-in account, or a "Guest" placeholder */
  user: Member;
  members: Member[];
  updateMember: (member: Member) => void;
  addMember: (member: Omit<Member, "id">) => void;
  removeMember: (id: number) => void;
  /** Presenter control: act as a guest, or sign in as the demo account for a role. Demo mode only. */
  viewAs: (view: View) => void;
  /** Every permission each view holds; owners can change these from Settings. */
  grants: Record<View, Permission[]>;
  setGrants: (grants: Record<View, Permission[]>) => void;
  can: (permission: Permission) => boolean;
  /** Whether component `id` in lib/rbac.config.ts COMPONENTS shows for this view */
  shows: (id: string) => boolean;
  audit: AuditEntry[];
  logAudit: (entry: Omit<AuditEntry, "id" | "user">) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(seedMembers);
  const [view, setView] = useState<View>("manager");
  const [grants, setGrants] = useState<Record<View, Permission[]>>(defaultGrants);
  const [audit, setAudit] = useState<AuditEntry[]>(seedAudit);
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [ssoMemberId, setSsoMemberId] = useState<number | null>(null);

  // Ask the worker who is signed in. No worker (503/502) or sign-in off means demo mode.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<AuthMe>) : null))
      .catch(() => null)
      .then((me) => {
        if (cancelled) return;
        if (!me?.authEnabled) {
          setAuthMode("demo");
          return;
        }
        setAuthMode("sso");
        if (!me.user) {
          setView("guest");
          return;
        }
        // The worker's roles match ours (lib/rbac.config.ts was ported from it); anything else is a member.
        const role: Role =
          VIEWS.includes(me.user.role as View) && me.user.role !== "guest" ? (me.user.role as Role) : "member";
        const account = me.user;
        const id = SSO_ID_OFFSET + account.id;
        setMembers((current) => {
          const rest = current.filter((member) => member.id !== id);
          return [...rest, { id, name: account.name, email: account.email, role, status: "active", activity: [] }];
        });
        setSsoMemberId(id);
        setView(role);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signedIn = view !== "guest";
  const user =
    view === "guest"
      ? GUEST_USER
      : authMode === "sso"
        ? (members.find((member) => member.id === ssoMemberId) ?? GUEST_USER)
        : (members.find((member) => member.id === demoAccountForRole[view]) ?? members[0]!);

  const startSignIn = useCallback((returnTo = "/") => {
    // A full page load on purpose: /api/auth/google is the worker's redirect to Google, not a page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  }, []);

  const signOut = useCallback(async () => {
    if (authMode === "sso") {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      setSsoMemberId(null);
    }
    setView("guest");
  }, [authMode]);

  // With real sign-in, the role comes from the worker; "View as" is for demo mode only.
  const viewAs = useCallback(
    (next: View) => {
      if (authMode !== "sso") setView(next);
    },
    [authMode],
  );

  const permissions = useMemo(() => new Set(grants[view]), [grants, view]);
  const can = useCallback((permission: Permission) => permissions.has(permission), [permissions]);
  const shows = useCallback((id: string) => componentVisible(id, view, permissions), [view, permissions]);

  const logAudit = useCallback(
    (entry: Omit<AuditEntry, "id" | "user">) => {
      setAudit((current) => [{ ...entry, id: (current[0]?.id ?? 0) + 1, user: user.name }, ...current]);
    },
    [user.name],
  );

  const updateMember = useCallback((member: Member) => {
    setMembers((current) => current.map((item) => (item.id === member.id ? member : item)));
  }, []);

  const addMember = useCallback((member: Omit<Member, "id">) => {
    setMembers((current) => [...current, { ...member, id: Math.max(...current.map((item) => item.id)) + 1 }]);
  }, []);

  const removeMember = useCallback((id: number) => {
    setMembers((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      authMode,
      startSignIn,
      signOut,
      view,
      signedIn,
      user,
      members,
      updateMember,
      addMember,
      removeMember,
      viewAs,
      grants,
      setGrants,
      can,
      shows,
      audit,
      logAudit,
    }),
    [
      authMode,
      startSignIn,
      signOut,
      view,
      signedIn,
      user,
      members,
      updateMember,
      addMember,
      removeMember,
      viewAs,
      grants,
      can,
      shows,
      audit,
      logAudit,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
