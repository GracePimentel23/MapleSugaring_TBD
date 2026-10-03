/** Role and permission rules from rbac.config.js. No database needed. */
import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgres://unused:unused@127.0.0.1:1/unused"; // createApp never connects here
const config = await import("../src/rbac.config.js");
const {
  accessFor, ALL_PERMISSIONS, ASSIGNABLE_ROLES, buildRolePermissions, configErrors, MANAGER_ROLES, permissionsFor,
  requirePermission, visibleComponents,
} = await import("../src/rbac.js");
const { roleChangeProblem } = await import("../src/users.js");
const { createApp } = await import("../src/app.js");

const sorted = (set) => [...set].sort();

test("the shipped config is valid: guest plus three roles", () => {
  assert.deepEqual(configErrors(config), []);
  assert.deepEqual(ASSIGNABLE_ROLES, ["member", "manager", "owner"]);
  assert.deepEqual(MANAGER_ROLES, ["owner"]);
  assert.equal(config.NEW_USER_ROLE, "member");
});

test("roles inherit, and each one can do strictly more than the one before", () => {
  const order = ["guest", "member", "manager", "owner"];
  for (let i = 1; i < order.length; i += 1) {
    const lower = permissionsFor(order[i - 1]);
    const higher = permissionsFor(order[i]);
    for (const permission of lower) assert.ok(higher.has(permission), `${order[i]} lacks ${permission}`);
    assert.ok(higher.size > lower.size, `${order[i]} adds nothing over ${order[i - 1]}`);
  }
  assert.deepEqual(sorted(permissionsFor("owner")), sorted(ALL_PERMISSIONS));
  assert.equal(permissionsFor("nobody").size, 0);
});

test("guests can only read the dashboard and stations; only owners manage people", () => {
  assert.deepEqual(sorted(permissionsFor("guest")), ["dashboard:view", "stations:view"]);
  for (const role of ["guest", "member", "manager"]) assert.equal(permissionsFor(role).has("users:manage"), false, role);
});

test("config mistakes are reported, not silently ignored", () => {
  const broken = {
    ...config,
    GUEST: { can: ["dashboard:veiw"] },
    ROLES: {
      member: { inherits: "gest", can: [] },
      loop: { inherits: "loop" },
      owner: { can: ["*"] },
    },
    COMPONENTS: { "a.card": "nope:view", "b.card": ["guest", "admin"] },
  };
  const errors = configErrors(broken).join("\n");
  assert.match(errors, /role "guest" has unknown permission "dashboard:veiw"/);
  assert.match(errors, /role "member" inherits unknown role "gest"/);
  assert.match(errors, /role "loop" inherits from itself/);
  assert.match(errors, /component "a.card" needs unknown permission "nope:view"/);
  assert.match(errors, /component "b.card" lists unknown role "admin"/);
  assert.match(configErrors({ ...config, NEW_USER_ROLE: "guest" }).join(), /NEW_USER_ROLE "guest" is not in ROLES/);
  assert.match(configErrors({ ...config, ROLES: { ...config.ROLES, guest: { can: [] } } }).join(), /"guest" is not a role/);
});

test("'*' expands to every permission", () => {
  const map = buildRolePermissions({
    PERMISSIONS: { "a:view": "", "b:edit": "" }, GUEST: { can: ["a:view"] }, ROLES: { x: { can: ["*"] }, y: { inherits: "x" } },
  });
  assert.deepEqual(sorted(map.get("guest")), ["a:view"]);
  assert.deepEqual(sorted(map.get("x")), ["a:view", "b:edit"]);
  assert.deepEqual(sorted(map.get("y")), ["a:view", "b:edit"]);
});

test("who a request is: sign-in off, DEV_ROLE preview, signed out, signed in", () => {
  const off = accessFor({ authEnabled: false });
  assert.equal(off.role, null);
  assert.equal(off.permissions.size, ALL_PERMISSIONS.length);
  assert.equal(accessFor({ authEnabled: false, devRole: "guest" }).role, "guest");
  assert.equal(accessFor({ authEnabled: true }).role, "guest");
  assert.equal(accessFor({ authEnabled: true, user: { role: "manager" } }).role, "manager");
  // DEV_ROLE never applies with sign-in on: config.js drops it, and a real user's role wins anyway.
  assert.equal(accessFor({ authEnabled: true, user: { role: "member" }, devRole: "owner" }).role, "member");
});

test("components follow permissions, or an explicit list of roles", () => {
  const components = { "nav.settings": "users:manage", "dash.card": "dashboard:view", "signin.prompt": ["guest"] };
  const guest = visibleComponents(accessFor({ authEnabled: true }), components);
  assert.deepEqual(guest, { "nav.settings": false, "dash.card": true, "signin.prompt": true });
  const owner = visibleComponents(accessFor({ authEnabled: true, user: { role: "owner" } }), components);
  assert.deepEqual(owner, { "nav.settings": true, "dash.card": true, "signin.prompt": false });
  // Sign-in off shows everything.
  assert.ok(Object.values(visibleComponents(accessFor({ authEnabled: false }), components)).every(Boolean));
});

test("requirePermission: next for allowed, 401 for guests, 403 for a signed-in role without it", () => {
  const guard = requirePermission("batches:manage");
  const run = (access) => {
    const result = { next: false, status: null, body: null };
    const res = {
      status(code) {
        result.status = code;
        return this;
      },
      json(body) {
        result.body = body;
      },
    };
    guard({ access }, res, () => (result.next = true));
    return result;
  };
  assert.equal(run(accessFor({ authEnabled: true, user: { role: "manager" } })).next, true);
  assert.equal(run(accessFor({ authEnabled: true })).status, 401);
  const member = run(accessFor({ authEnabled: true, user: { role: "member" } }));
  assert.equal(member.status, 403);
  assert.match(member.body.error, /member role cannot do this \(needs batches:manage\)/);
  assert.equal(run(undefined).status, 401);
  assert.throws(() => requirePermission("collections:typo"), /unknown permission/);
});

test("the last owner cannot be demoted, ADMIN_EMAILS stay owner, guest is not assignable", () => {
  assert.deepEqual(roleChangeProblem({ fromRole: "owner", toRole: "manager", email: "a@x", managerCount: 1 }), {
    status: 409, error: "this is the last owner; make someone else owner first",
  });
  assert.equal(roleChangeProblem({ fromRole: "owner", toRole: "manager", email: "a@x", managerCount: 2 }), null);
  assert.equal(roleChangeProblem({ fromRole: "owner", toRole: "owner", email: "a@x", managerCount: 1 }), null);
  assert.equal(roleChangeProblem({ fromRole: "member", toRole: "manager", email: "m@x", managerCount: 1 }), null);
  assert.equal(
    roleChangeProblem({ fromRole: "owner", toRole: "member", email: "Boss@x", managerCount: 3, adminEmails: ["boss@x"] }).status,
    409,
  );
  assert.equal(roleChangeProblem({ fromRole: "member", toRole: "guest", email: "m@x", managerCount: 1 }).status, 400);
  assert.equal(roleChangeProblem({ fromRole: "member", toRole: "admin", email: "m@x", managerCount: 1 }).status, 400);
});

test("every API route names a permission, except health, ingest and sign-in", () => {
  const open = new Set(["GET /health", "POST /ingest", "GET /auth/me", "POST /auth/logout", "GET /auth/google", "GET /auth/google/callback"]);
  const routes = [];
  const walk = (stack) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          const permission = layer.route.stack.find((step) => step.handle.permission)?.handle.permission;
          routes.push({ name: `${method.toUpperCase()} ${layer.route.path}`, permission });
        }
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack);
      }
    }
  };
  walk(createApp().router.stack);
  assert.ok(routes.length > 20, "found the routes");
  const unguarded = routes.filter((route) => !route.permission && !open.has(route.name)).map((route) => route.name);
  assert.deepEqual(unguarded, [], "add can(\"area:action\") to these routes");
  for (const name of open) assert.ok(routes.some((route) => route.name === name), `${name} still exists`);
});
