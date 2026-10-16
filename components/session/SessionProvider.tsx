"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoAccountForRole, seedMembers, type Member } from "@/lib/data/people";
import { componentVisible, defaultGrants } from "@/lib/rbac";
import type { Permission, View } from "@/lib/rbac.config";

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
  { id: 4, when: "2/28, 4:12 PM", user: "Dana K.", action: "Changed threshold", record: "Sap age, warn", change: "20 h to 24 h" },
  { id: 3, when: "2/28, 3:50 PM", user: "Grace P.", action: "Added tree", record: "Bucket #05", change: "West Field, tree 1" },
  { id: 2, when: "2/27, 11:05 AM", user: "Dana K.", action: "Started season", record: "Season 2022", change: "2/28 to 3/14" },
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

interface SessionValue {
  /** Who is looking: "guest" (signed out) or a role */
  view: View;
  signedIn: boolean;
  /** The signed-in account, or a "Guest" placeholder */
  user: Member;
  members: Member[];
  updateMember: (member: Member) => void;
  addMember: (member: Omit<Member, "id">) => void;
  removeMember: (id: number) => void;
  /** Presenter control: act as a guest, or sign in as the demo account for a role. */
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

  const signedIn = view !== "guest";
  const user =
    view === "guest"
      ? GUEST_USER
      : (members.find((member) => member.id === demoAccountForRole[view]) ?? members[0]!);

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
      view,
      signedIn,
      user,
      members,
      updateMember,
      addMember,
      removeMember,
      viewAs: setView,
      grants,
      setGrants,
      can,
      shows,
      audit,
      logAudit,
    }),
    [view, signedIn, user, members, updateMember, addMember, removeMember, grants, can, shows, audit, logAudit],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
