/**
 * Club members and what each role may do. There is one Owner / IT account, a
 * few Managers (teachers or advisors) and Members (students and volunteers).
 * Everyone signs in; there is no guest view.
 */

export type Role = "owner" | "manager" | "member";

export const roleLabels: Record<Role, string> = {
  owner: "Owner / IT",
  manager: "Manager",
  member: "Member",
};

export type Permission =
  | "viewData"
  | "logCollections"
  | "editOwnCollections"
  | "editAnyCollection"
  | "editBatches"
  | "closeBatch"
  | "editClosedBatch"
  | "maintenance"
  | "editTrees"
  | "editSeason"
  | "manageMembers"
  | "assignManager"
  | "editThresholds"
  | "editRolePermissions"
  | "deleteData";

/** In the order the Role Permissions table lists them. */
export const permissionLabels: { key: Permission; label: string }[] = [
  { key: "viewData", label: "View dashboard and data" },
  { key: "logCollections", label: "Log collections" },
  { key: "editOwnCollections", label: "Edit own collections" },
  { key: "editAnyCollection", label: "Edit any collection" },
  { key: "editBatches", label: "Create and edit batches" },
  { key: "closeBatch", label: "Close a batch" },
  { key: "editClosedBatch", label: "Edit a closed batch" },
  { key: "maintenance", label: "Maintenance mode" },
  { key: "editTrees", label: "Add and edit trees and sensors" },
  { key: "editSeason", label: "Edit season dates" },
  { key: "manageMembers", label: "Add, edit and remove members" },
  { key: "assignManager", label: "Assign Manager role" },
  { key: "editThresholds", label: "Edit thresholds" },
  { key: "editRolePermissions", label: "Edit role permissions" },
  { key: "deleteData", label: "Delete data permanently" },
];

/** Only the Owner / IT account can ever hold these; they are not editable per role. */
export const ownerOnlyPermissions: Permission[] = [
  "editThresholds",
  "editRolePermissions",
  "deleteData",
];

export type RolePermissions = Record<"manager" | "member", Record<Permission, boolean>>;

function grant(keys: Permission[]): Record<Permission, boolean> {
  return Object.fromEntries(
    permissionLabels.map(({ key }) => [key, keys.includes(key)]),
  ) as Record<Permission, boolean>;
}

export const defaultRolePermissions: RolePermissions = {
  manager: grant([
    "viewData",
    "logCollections",
    "editOwnCollections",
    "editAnyCollection",
    "editBatches",
    "closeBatch",
    "maintenance",
    "editTrees",
    "editSeason",
    "manageMembers",
    "assignManager",
  ]),
  member: grant(["viewData", "logCollections", "editOwnCollections"]),
};

export type MemberStatus = "active" | "invited" | "deactivated";

export interface Member {
  id: number;
  name: string;
  email: string;
  role: Role;
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
