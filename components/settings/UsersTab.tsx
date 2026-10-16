"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/DemoProvider";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { Button, Card, CardTitle, Checkbox, cx, DataTable, Field, inputClass, Modal } from "@/components/ui/ui";
import { roleLabels, type Member, type Role } from "@/lib/data/people";
import { ALL_PERMISSIONS, VIEWS, viewLabels } from "@/lib/rbac";
import { OWNER_ONLY, PERMISSIONS, type Permission, type View } from "@/lib/rbac.config";
import { tableStamp } from "@/lib/time";

const statusColor: Record<Member["status"], string> = {
  active: "var(--color-status-online)",
  invited: "var(--color-status-maintenance)",
  deactivated: "var(--color-muted)",
};

const statusLabel: Record<Member["status"], string> = {
  active: "Active",
  invited: "Invited",
  deactivated: "Deactivated",
};


function EditMemberModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const { day } = useDemo();
  const { user, view, can, updateMember, removeMember, logAudit } = useSession();
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<Role>(member.role);
  const isOwner = view === "owner";
  const roleChoices: Role[] = isOwner ? ["member", "manager", "owner"] : ["member", "manager"];
  const lockedRole = member.role === "owner" && !isOwner;

  function save() {
    updateMember({
      ...member,
      name,
      email,
      role,
      status: email !== member.email && member.status !== "deactivated" ? "invited" : member.status,
    });
    logAudit({
      when: tableStamp(day.date),
      action: "Edited member",
      record: member.name,
      change: role !== member.role ? `${roleLabels[member.role]} to ${roleLabels[role]}` : "Details updated",
    });
    onClose();
  }

  function deactivate() {
    updateMember({ ...member, status: "deactivated" });
    logAudit({ when: tableStamp(day.date), action: "Deactivated member", record: member.name, change: "Can no longer sign in" });
    onClose();
  }

  function remove() {
    if (!window.confirm(`Permanently delete ${member.name}? This cannot be undone.`)) return;
    removeMember(member.id);
    logAudit({ when: tableStamp(day.date), action: "Deleted member", record: member.name, change: "Removed permanently" });
    onClose();
  }

  return (
    <Modal title="Edit member" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name">
          <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Email" hint="Fix a typo here and a new invite goes out.">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </Field>
        <Field
          label="Role"
          hint="Managers can set Member or Manager. Only Owner / IT can make another Owner."
        >
          <select
            value={role}
            disabled={lockedRole || member.id === user.id}
            onChange={(event) => setRole(event.target.value as Role)}
            className={inputClass}
          >
            {(lockedRole ? [member.role] : roleChoices).map((choice) => (
              <option key={choice} value={choice}>
                {roleLabels[choice]}
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

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={lockedRole}>
            Save Changes
          </Button>
        </div>

        {member.id !== user.id && !lockedRole ? (
          <div className="border-t border-border pt-5 pb-6">
            <h3 className="font-sans text-lg font-semibold">Remove from club</h3>
            <p className="mb-4 text-sm text-muted">
              They can no longer sign in. Their past collections stay and show their name.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="danger" onClick={deactivate} disabled={member.status === "deactivated"}>
                Deactivate Member
              </Button>
              <Button variant="danger" onClick={remove} disabled={!can("data:delete")}>
                Delete Permanently (Owner / IT)
              </Button>
            </div>
          </div>
        ) : (
          <div className="pb-4" />
        )}
      </div>
    </Modal>
  );
}

function EditPermissionsModal({ onClose }: { onClose: () => void }) {
  const { day } = useDemo();
  const { grants, setGrants, logAudit } = useSession();
  const [draft, setDraft] = useState<Record<View, Permission[]>>(grants);
  const [editing, setEditing] = useState<Exclude<View, "owner">>("manager");
  const editable = ALL_PERMISSIONS.filter((permission) => !OWNER_ONLY.includes(permission));

  function toggle(permission: Permission, on: boolean) {
    setDraft((current) => ({
      ...current,
      [editing]: on
        ? [...current[editing], permission]
        : current[editing].filter((item) => item !== permission),
    }));
  }

  function save() {
    setGrants(draft);
    logAudit({
      when: tableStamp(day.date),
      action: "Changed role permissions",
      record: "Guest, Member, Manager",
      change: "Updated",
    });
    onClose();
  }

  return (
    <Modal
      title="Edit role permissions"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save Permissions</Button>
        </>
      }
    >
      <div className="mb-4 flex gap-2">
        {(["manager", "member", "guest"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setEditing(option)}
            className={cx(
              "rounded-full px-4 py-1.5 font-sans text-[15px] font-semibold",
              editing === option ? "bg-accent text-white" : "text-slate hover:bg-bg",
            )}
          >
            {viewLabels[option]}
          </button>
        ))}
      </div>
      <p className="mb-5 text-sm text-muted">
        Owner / IT can always do everything. Check what a {viewLabels[editing]} can do.
      </p>
      <div className="space-y-4">
        {editable.map((permission) => (
          <Checkbox
            key={permission}
            label={PERMISSIONS[permission]}
            checked={draft[editing].includes(permission)}
            onChange={(checked) => toggle(permission, checked)}
          />
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">
        Owner-only: change role permissions, change alert thresholds, delete data permanently. The
        defaults live in lib/rbac.config.ts, matching worker/src/rbac.config.js on main.
      </p>
    </Modal>
  );
}

export default function UsersTab() {
  const { day } = useDemo();
  const { members, can, grants, addMember, logAudit } = useSession();
  const [editing, setEditing] = useState<Member | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const manage = can("users:manage");

  function invite() {
    const email = inviteEmail.trim();
    if (!email.includes("@")) return;
    const name = email.split("@")[0]!.replace(/^\w/, (letter) => letter.toUpperCase());
    addMember({ name, email, role: inviteRole, status: "invited", activity: [] });
    logAudit({ when: tableStamp(day.date), action: "Invited member", record: email, change: roleLabels[inviteRole] });
    setInviteEmail("");
  }

  return (
    <>
      <Card className="md:px-8 md:py-7">
        <CardTitle
          title="Members"
          subtitle="Managers can add, edit and remove members. Removing keeps their history so past collections still show their name."
          action={
            manage ? (
              <Button variant="outline" size="sm" onClick={() => document.getElementById("invite-email")?.focus()}>
                <PlusIcon size={14} />
                Add Member
              </Button>
            ) : null
          }
        />
        <DataTable
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "status", label: "Status" },
            { key: "activity", label: "Recent activity" },
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
              role: roleLabels[member.role],
              status: (
                <span className="font-semibold" style={{ color: statusColor[member.status] }}>
                  {statusLabel[member.status]}
                </span>
              ),
              activity: member.activity[0]
                ? `${member.activity[0].what} · ${member.activity[0].when.split(",")[0]}`
                : "Not signed in yet",
              go: manage ? <ChevronRightIcon size={18} /> : null,
            },
          }))}
        />
      </Card>

      {manage ? (
        <div>
          <h3 className="font-sans text-base font-semibold">Invite a Member by Email</h3>
          <p className="mb-3 text-sm text-muted">
            They get a link to set a password. Managers and the Owner / IT can invite.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Field label="Email">
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="name@school.edu"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Role">
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as Role)}
                className={inputClass}
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
            <Button variant="outline" onClick={invite} disabled={!inviteEmail.includes("@")}>
              Send Invite
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="md:px-8 md:py-7">
        <CardTitle
          title="Role Permissions"
          subtitle="Fixed per role. Only the Owner / IT account can change what a role is allowed to do."
          action={
            can("roles:manage") ? (
              <Button variant="outline" size="sm" onClick={() => setShowPermissions(true)}>
                Edit Permissions
              </Button>
            ) : null
          }
        />
        <DataTable
          columns={[
            { key: "permission", label: "Permission" },
            ...VIEWS.map((item) => ({ key: item, label: viewLabels[item] })),
          ]}
          rows={ALL_PERMISSIONS.map((permission) => ({
            key: permission,
            cells: {
              permission: (
                <span>
                  {PERMISSIONS[permission]}
                  <span className="block font-mono text-[11px] text-muted">{permission}</span>
                </span>
              ),
              ...Object.fromEntries(
                VIEWS.map((item) => [item, grants[item].includes(permission) ? "Yes" : "No"]),
              ),
            },
          }))}
        />
      </Card>

      {editing ? <EditMemberModal member={editing} onClose={() => setEditing(null)} /> : null}
      {showPermissions ? <EditPermissionsModal onClose={() => setShowPermissions(false)} /> : null}
    </>
  );
}
