# Front end roles: quick guide

You only edit **one file** to change who sees what: [`worker/src/rbac.config.js`](../worker/src/rbac.config.js). It lists every card, tab and button (under `COMPONENTS`) and who may see it.

## The views

| View | Who | Sees |
|---|---|---|
| `guest` | Not signed in | Dashboard, Stations |
| `member` | Signed in (default) | + Data tab, log collections, resolve alerts |
| `manager` | Promoted by an owner | + add/edit stations, edit collections, manage batches |
| `owner` | Club lead | Everything, including Settings and roles |

Guest is just someone looking at the site. It is not an account.

## Show or hide a component

1. Add an id to `COMPONENTS` in `worker/src/rbac.config.js`:

   ```js
   "dashboard.myCard": "dashboard:view",     // option A: everyone who has this permission
   "dashboard.myCard": ["manager", "owner"], // option B: only these roles (use one line)
   ```

2. Wrap the component:

   ```tsx
   import { ShowFor } from "@/components/auth/AccessContext";

   <ShowFor id="dashboard.myCard">
     <MyCard />
   </ShowFor>
   ```

3. Restart `npm run dev` (the config is read on start).

To change who sees an existing card, edit its line in `COMPONENTS`. No other file changes.

If an id is not in `COMPONENTS`, the component is hidden and the browser console warns you.

## Test by switching role

Easiest: with sign-in off, click the profile icon (top right) and pick a role under **View as**.

Or start the whole app as one role, from the repo root (PowerShell):

```powershell
$env:DEV_ROLE="guest"; npm run dev
```

Use `guest`, `member`, `manager` or `owner`, then open http://localhost:3000. To go back to seeing everything:

```powershell
Remove-Item Env:DEV_ROLE; npm run dev
```

## Good to know

- Hiding a component is only for looks. The server also blocks anything the role can't do.
- Examples of wrapped components: [`web/app/page.tsx`](../web/app/page.tsx).
- More detail: [`docs/RBAC.md`](RBAC.md).
