# Roles (RBAC)

Everything lives in one file: [`worker/src/rbac.config.js`](../worker/src/rbac.config.js).

| View | Who |
|---|---|
| guest | Not signed in. Not a role, just the lack of one |
| `member` | Signed in (everyone starts here) |
| `manager` | Promoted by an owner |
| `owner` | Everything, including roles |

## Show or hide a card for a role

1. In `rbac.config.js` → `COMPONENTS`, add an id and who sees it:
   `"dashboard.sapChart": "dashboard:view"` (a permission) or `["manager", "owner"]` (roles).
2. Wrap the card: `<ShowFor id="dashboard.sapChart">…</ShowFor>` (from `@/components/auth/AccessContext`).
3. Restart `npm run dev`.

## Let a role do more

Add the permission to that role's `can` list in `ROLES` (or `GUEST` for signed-out visitors).
The worker enforces it on the API. In code: `useCan("batches:manage")` or `<Can permission="batches:manage">`.

## Preview a role locally

With sign-in off, click the profile icon (top right) and pick a role under **View as**.
Or start as one: `$env:DEV_ROLE="guest"; npm run dev`.
