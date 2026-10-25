/**
 * People and roles (owner): list users, change a user's role, list roles, read the audit log.
 * Role changes are audited, and the last user who can manage users cannot be demoted.
 */
import { Router } from "express";
import { config } from "./config.js";
import { pool, withTransaction } from "./db.js";
import { HttpError, idParam, optionalText, wrap } from "./http.js";
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
      `select u.id, u.email, u.full_name as name, u.pronouns, coalesce(r.role_name, $1) as role, u.last_login_at
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
        `insert into audit_log (actor_id, actor_email, actor_name, entity, entity_id, action, before, after, record, change)
         values ($1, $2, $3, 'user', $4, 'role_change', $5, $6, $7, $8)`,
        [req.user?.id ?? null, req.user?.email ?? null, req.user?.name ?? null, String(id), { role: target.role ?? null },
          { role: toRole }, target.email, `${fromRole} to ${toRole}`],
      );
      return { user: { id: target.id, email: target.email, role: toRole }, changed: true };
    });
    res.json({ ok: true, ...result });
  }));

  /** { name?, pronouns? } for your own account (Account page). Needs sign-in: with it off there is no "you". */
  router.patch("/me", requirePermission("account:edit"), wrap(async (req, res) => {
    if (!req.user) throw new HttpError(409, "sign-in is off, so there is no account to edit");
    const name = optionalText(req.body?.name, "name", 100);
    const pronouns = req.body?.pronouns === undefined ? undefined : optionalText(req.body.pronouns, "pronouns", 40);
    await pool.query(
      `update users set full_name = coalesce($2, full_name), pronouns = case when $4 then $3 else pronouns end
        where id = $1`,
      [req.user.id, name, pronouns ?? null, pronouns !== undefined],
    );
    res.json({ ok: true });
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
      `select a.id, a.at, a.actor_id, a.actor_email, coalesce(u.full_name, a.actor_name, a.actor_email) as actor,
              a.entity, a.entity_id, a.action, a.before, a.after, a.reason, a.record, a.change
         from audit_log a left join users u on u.id = a.actor_id
        ${where.length ? `where ${where.map((clause) => `a.${clause}`).join(" and ")}` : ""}
        order by a.at desc, a.id desc limit 500`,
      params,
    );
    res.json(rows);
  }));

  return router;
}
