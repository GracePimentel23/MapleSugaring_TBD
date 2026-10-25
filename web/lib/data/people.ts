/**
 * Club members: everyone who has signed in. Their roles and what each role may do come from
 * worker/src/rbac.config.js (GET /api/auth/me sends the whole rulebook).
 */

/** A role a signed-in person can have, e.g. "member", "manager", "owner". */
export type Role = string;
/** "guest" (signed out) or a role. */
export type View = string;

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
