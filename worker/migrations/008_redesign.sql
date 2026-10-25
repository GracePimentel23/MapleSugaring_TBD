-- What the redesigned front end (design-changes) needs from the database.

-- buckets: where the tree is on the Stations map, and retired trees (hidden, data kept).
alter table buckets add column if not exists lat     double precision;
alter table buckets add column if not exists lon     double precision;
alter table buckets add column if not exists retired boolean not null default false;

-- alerts: "acknowledged" means someone is on it; resolved still means fixed.
alter table alerts add column if not exists acknowledged_at timestamptz;
alter table alerts add column if not exists acknowledged_by varchar(100);
alter table alerts add column if not exists resolved_by     varchar(100);

-- batches: time on the evaporator once finished.
alter table batches add column if not exists boil_minutes integer;

-- users: pronouns people set for themselves on the Account page.
alter table users add column if not exists pronouns varchar(40);

-- notes left on a station or a batch, newest first in the UI.
create table if not exists notes (
    id         integer generated always as identity primary key,
    subject    varchar(10) not null check (subject in ('bucket', 'batch')),
    subject_id integer not null,
    text       text not null,
    author     varchar(100),
    created_at timestamptz not null default current_timestamp
);
create index if not exists notes_subject_idx on notes (subject, subject_id, created_at desc);

-- audit_log: a readable line for the Settings > Audit Log tab ("Bucket #02", "12 lbs to 14 lbs").
-- actor_name is who did it as shown (with sign-in off, the "View as" account name the browser sends).
alter table audit_log add column if not exists actor_name varchar(100);
alter table audit_log add column if not exists record     text;
alter table audit_log add column if not exists change     text;
