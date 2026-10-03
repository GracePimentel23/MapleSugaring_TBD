/**
 * People and roles (owner): list users, change a user's role, list roles, read the audit log.
 * Role changes are audited, and the last user who can manage users cannot be demoted.
 */
import { Router } from "express";
import { config } from "./config.js";
import { pool, withTransaction } from "./db.js";
import { HttpError, idParam, wrap } from "./http.js";
import { OWNER_ROLE, ASSIGNABLE_ROLES, MANAGER_ROLES, NEW_USER_ROLE, requirePermission, rolesSummary } from "./rbac.js";

/**
 * Why a role change must be refused, or null if it is fine. Pure, so the rules are unit tested.
 * managerCount: users who currently hold a role that can manage users (MANAGER_ROLES).
 */
export function roleChangeProblem({ fromRole, toRole, email, managerCount, adminEmails = [] }) {
  if (!ASSIGNABLE_ROLES.includes(toRole)) return { status: 400, error: `role must be one of ${ASSIGNABLE_ROLES.join(", ")}` };
  if (adminEmails.includes(String(email).toLowerCase()) && toRole !== OWNER_ROLE) {
    return { status: 409, error: "this address is in ADMIN_EMAILS, so signing in makes it owner again; remove it there first" };
  }
  if (MANAGER_ROLES.includes(fromRole) && !MANAGER_ROLES.includes(toRole) && managerCount <= 1) {
    return { status: 409, error: "this is the last owner; make someone else owner first" };
  }
  return null;
}

export function usersRouter() {
  const router = Router();

  router.get("/users", requirePermission("users:manage"), wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `select u.id, u.email, u.full_name as name, coalesce(r.role_name, $1) as role, u.last_login_at
         from users u left join roles r on r.id = u.role_id order by u.id`,
      [NEW_USER_ROLE],
    );
    res.json(rows.map((user) => ({ ...user, role: ASSIGNABLE_ROLES.includes(user.role) ? user.role : NEW_USER_ROLE })));
  }));

  /** { role }. Answers { ok, user: { id, email, role }, changed }. */
  router.patch("/users/:id", requirePermission("users:manage"), wrap(async (req, res) => {
    const id = idParam(req.params.id);
    const toRole = String(req.body?.role ?? "");
    const result = await withTransaction(async (client) => {
      // Lock everyone who can manage users, so two owners demoting each other at once cannot both win.
      const managers = await client.query(
        `select u.id from users u join roles r on r.id = u.role_id where r.role_name = any($1) for update of u`,
        [MANAGER_ROLES],
      );
      const target = (
        await client.query(
          `select u.id, u.email, r.role_name as role from users u left join roles r on r.id = u.role_id
            where u.id = $1 for update of u`,
          [id],
        )
      ).rows[0];
      if (!target) throw new HttpError(404, "no such user");
      const fromRole = ASSIGNABLE_ROLES.includes(target.role) ? target.role : NEW_USER_ROLE;

      const problem = roleChangeProblem({
        fromRole, toRole, email: target.email, managerCount: managers.rowCount, adminEmails: config.auth.adminEmails,
      });
      if (problem) throw new HttpError(problem.status, problem.error);
      if (fromRole === toRole && target.role === toRole) return { user: { ...target, role: toRole }, changed: false };

      await client.query("update users set role_id = (select id from roles where role_name = $2) where id = $1", [id, toRole]);
      await client.query(
        `insert into audit_log (actor_id, actor_email, entity, entity_id, action, before, after)
         values ($1, $2, 'user', $3, 'role_change', $4, $5)`,
        [req.user?.id ?? null, req.user?.email ?? null, String(id), { role: target.role ?? null }, { role: toRole }],
      );
      return { user: { id: target.id, email: target.email, role: toRole }, changed: true };
    });
    res.json({ ok: true, ...result });
  }));

  /** Every role with its label and expanded permissions, for a role picker. */
  router.get("/roles", requirePermission("users:manage"), (_req, res) => res.json(rolesSummary()));

  /** Newest first. ?entity=user&id=12 narrows it to one thing. */
  router.get("/audit", requirePermission("audit:view"), wrap(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.entity) {
      params.push(String(req.query.entity));
      where.push(`entity = $${params.length}`);
    }
    if (req.query.id) {
      params.push(String(req.query.id));
      where.push(`entity_id = $${params.length}`);
    }
    const { rows } = await pool.query(
      `select id, at, actor_id, actor_email, entity, entity_id, action, before, after, reason from audit_log
        ${where.length ? `where ${where.join(" and ")}` : ""} order by at desc, id desc limit 200`,
      params,
    );
    res.json(rows);
  }));

  return router;
}
