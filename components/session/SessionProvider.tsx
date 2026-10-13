"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultRolePermissions,
  demoAccountForRole,
  seedMembers,
  type Member,
  type Permission,
  type Role,
  type RolePermissions,
} from "@/lib/data/people";

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
  {
    id: 1,
    when: "2/27, 10:40 AM",
    user: "Dana K.",
    action: "Invited member",
    record: "Alex R.",
    change: "Member",
  },
];

interface SessionValue {
  user: Member;
  members: Member[];
  updateMember: (member: Member) => void;
  addMember: (member: Omit<Member, "id">) => void;
  removeMember: (id: number) => void;
  /** Presenter control: sign in as the demo account for a role. */
  viewAs: (role: Role) => void;
  rolePermissions: RolePermissions;
  setRolePermissions: (permissions: RolePermissions) => void;
  can: (permission: Permission) => boolean;
  audit: AuditEntry[];
  logAudit: (entry: Omit<AuditEntry, "id" | "user">) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(seedMembers);
  const [userId, setUserId] = useState(demoAccountForRole.manager);
  const [rolePermissions, setRolePermissions] = useState(defaultRolePermissions);
  const [audit, setAudit] = useState<AuditEntry[]>(seedAudit);

  const user = members.find((member) => member.id === userId) ?? members[0]!;

  const can = useCallback(
    (permission: Permission) =>
      user.role === "owner" ? true : rolePermissions[user.role][permission],
    [user.role, rolePermissions],
  );

  const logAudit = useCallback(
    (entry: Omit<AuditEntry, "id" | "user">) => {
      setAudit((current) => [
        { ...entry, id: (current[0]?.id ?? 0) + 1, user: user.name },
        ...current,
      ]);
    },
    [user.name],
  );

  const updateMember = useCallback((member: Member) => {
    setMembers((current) => current.map((item) => (item.id === member.id ? member : item)));
  }, []);

  const addMember = useCallback((member: Omit<Member, "id">) => {
    setMembers((current) => [
      ...current,
      { ...member, id: Math.max(...current.map((item) => item.id)) + 1 },
    ]);
  }, []);

  const removeMember = useCallback((id: number) => {
    setMembers((current) => current.filter((item) => item.id !== id));
  }, []);

  const viewAs = useCallback((role: Role) => setUserId(demoAccountForRole[role]), []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      members,
      updateMember,
      addMember,
      removeMember,
      viewAs,
      rolePermissions,
      setRolePermissions,
      can,
      audit,
      logAudit,
    }),
    [user, members, updateMember, addMember, removeMember, viewAs, rolePermissions, can, audit, logAudit],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
