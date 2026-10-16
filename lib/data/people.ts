/**
 * Club members. There is one Owner / IT account, a few Managers (teachers or
 * advisors) and Members (students and volunteers). What each role may do is
 * in lib/rbac.config.ts.
 */

import { ROLES, type Role } from "@/lib/rbac.config";

export type { Role };

/** "Owner / IT", "Manager", "Member": from lib/rbac.config.ts. */
export const roleLabels = Object.fromEntries(
  (Object.keys(ROLES) as Role[]).map((role) => [role, ROLES[role].label]),
) as Record<Role, string>;

export type MemberStatus = "active" | "invited" | "deactivated";

export interface Member {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** Optional, set by the member themselves, e.g. "she/her", "they/them" */
  pronouns?: string;
  status: MemberStatus;
  /** Newest first */
  activity: { when: string; what: string }[];
}

export const seedMembers: Member[] = [
  {
    id: 1,
    name: "Dana K.",
    email: "dana@school.edu",
    role: "owner",
    status: "active",
    activity: [{ when: "3/10, 4:12 PM", what: "Changed threshold, sap age warn" }],
  },
  {
    id: 2,
    name: "Grace P.",
    email: "grace@school.edu",
    role: "manager",
    status: "active",
    activity: [{ when: "3/7, 3:50 PM", what: "Maintenance on, #04" }],
  },
  {
    id: 3,
    name: "Mr. Adams",
    email: "adams@school.edu",
    role: "manager",
    status: "active",
    activity: [{ when: "3/8, 8:05 AM", what: "Logged #02, #04 and #05" }],
  },
  {
    id: 4,
    name: "Sam R.",
    email: "sam@school.edu",
    role: "member",
    status: "active",
    activity: [
      { when: "3/10, 8:10 AM", what: "Logged #01 and #03" },
      { when: "3/8, 10:20 AM", what: "Note on Batch #02" },
    ],
  },
  {
    id: 5,
    name: "Chloe M.",
    email: "chloe@school.edu",
    role: "member",
    status: "active",
    activity: [{ when: "3/6, 8:00 AM", what: "Logged #01 and #03" }],
  },
  {
    id: 6,
    name: "Jordan T.",
    email: "jordan@school.edu",
    role: "member",
    status: "active",
    activity: [{ when: "3/8, 8:15 AM", what: "Logged #05" }],
  },
  {
    id: 7,
    name: "Alex R.",
    email: "alex@school.edu",
    role: "member",
    status: "invited",
    activity: [],
  },
];

/** Who the demo signs in as for each role, so a presenter can switch views. */
export const demoAccountForRole: Record<Role, number> = {
  owner: 1,
  manager: 3,
  member: 4,
};
