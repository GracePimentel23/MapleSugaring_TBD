-- Role-based access control. The roles and what they may do live in worker/src/rbac.config.js; the
-- worker adds any missing role names to `roles` on every boot.
--
-- The roles are now member, manager and owner (signed out is "guest", which is not a role). Move
-- users off the names from 003: admin -> owner, viewer -> member.

insert into roles (role_name) values ('member'), ('owner') on conflict (role_name) do nothing;
update users set role_id = (select id from roles where role_name = 'owner')
 where role_id = (select id from roles where role_name = 'admin');
update users set role_id = (select id from roles where role_name = 'member')
 where role_id = (select id from roles where role_name = 'viewer');
delete from roles where role_name in ('viewer', 'admin');

-- audit_log records changes made through the API, starting with role changes. It is generic
-- (entity + id + before/after) so other writes can be audited later without another table.

create table if not exists audit_log (
    id          bigint generated always as identity primary key,
    at          timestamptz not null default current_timestamp,
    actor_id    integer references users on delete set null, -- who did it; null for the system or sign-in off
    actor_email varchar(255),                                 -- kept even if that user is deleted
    entity      varchar(50) not null,                         -- e.g. 'user'
    entity_id   text,
    action      varchar(50) not null,                         -- e.g. 'role_change'
    before      jsonb,
    after       jsonb,
    reason      text
);

create index if not exists audit_log_entity_idx on audit_log (entity, entity_id, at desc);
