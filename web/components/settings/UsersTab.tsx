"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, CardTitle, DataTable, Field, inputClass, Modal } from "@/components/ui/ui";
import type { Member, Role } from "@/lib/data/people";

function EditMemberModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const { user, roles, viewLabels, updateMember } = useSession();
  const [role, setRole] = useState<Role>(member.role);
  const [saving, setSaving] = useState(false);
  const isSelf = member.id === user.id;

  async function save() {
    if (role === member.role) return onClose();
    setSaving(true);
    const ok = await updateMember({ ...member, role });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal title="Edit member" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name" hint="Set by the member on their Account page.">
          <input value={member.name} disabled className={inputClass} />
        </Field>
        <Field label="Email" hint="Their Google account.">
          <input type="email" value={member.email} disabled className={inputClass} />
        </Field>
        <Field
          label="Role"
          hint={isSelf ? "You can't change your own role; ask another owner." : "Takes effect on their next page load."}
        >
          <select
            value={role}
            disabled={isSelf}
            onChange={(event) => setRole(event.target.value)}
            className={inputClass}
          >
            {roles.map((choice) => (
              <option key={choice} value={choice}>
                {viewLabels[choice] ?? choice}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <p className="mb-2 text-sm text-muted">Recent activity</p>
          <DataTable
            empty="Nothing yet."
            columns={[
              { key: "when", label: "When" },
              { key: "what", label: "What" },
            ]}
            rows={member.activity.map((item) => ({ key: `${item.when}-${item.what}`, cells: item }))}
          />
        </div>

        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || isSelf}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function UsersTab() {
  const { members, can, grants, views, viewLabels, permissionLabels, authEnabled } = useSession();
  const [editing, setEditing] = useState<Member | null>(null);
  const manage = can("users:manage");
  const permissions = Object.keys(permissionLabels);

  return (
    <>
      <Card className="md:px-8 md:py-7">
        <CardTitle
          title="Members"
          subtitle={
            authEnabled
              ? "Everyone who has signed in with Google. New people start as members; change a role here."
              : "Sign-in is off on this server, so anyone can use any view. Roles set here apply once Google sign-in is on."
          }
        />
        <DataTable
          empty="Nobody has signed in yet."
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "activity", label: "Last sign-in" },
            { key: "go", label: "" },
          ]}
          rows={members.map((member) => ({
            key: String(member.id),
            onClick: manage ? () => setEditing(member) : undefined,
            cells: {
              name: (
                <span>
                  {member.name}
                  {member.pronouns ? <span className="block text-xs text-muted">{member.pronouns}</span> : null}
                </span>
              ),
              email: member.email,
              role: viewLabels[member.role] ?? member.role,
              activity: member.activity[0]?.when ?? "Not signed in yet",
              go: manage ? <ChevronRightIcon size={18} /> : null,
            },
          }))}
        />
      </Card>

      <Card className="md:px-8 md:py-7">
        <CardTitle
          title="Role Permissions"
          subtitle="What each role may do. These are set in worker/src/rbac.config.js; the API checks them on every request."
        />
        <DataTable
          columns={[
            { key: "permission", label: "Permission" },
            ...views.map((item) => ({ key: item, label: viewLabels[item] ?? item })),
          ]}
          rows={permissions.map((permission) => ({
            key: permission,
            cells: {
              permission: (
                <span>
                  {permissionLabels[permission]}
                  <span className="block font-mono text-[12px] text-muted">{permission}</span>
                </span>
              ),
              ...Object.fromEntries(
                views.map((item) => [item, (grants[item] ?? []).includes(permission) ? "Yes" : "No"]),
              ),
            },
          }))}
        />
      </Card>

      {editing ? <EditMemberModal member={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
