-- Google sign-in: roles, the Google account id on users, and server-side sessions.
-- The session cookie carries a random token (HMAC-signed); only its sha256 is stored here, so a
-- database leak does not hand out live sessions, and deleting a row logs that browser out.

insert into roles (role_name) values ('admin'), ('member'), ('viewer') on conflict (role_name) do nothing;

alter table users add column if not exists google_sub    varchar(255) unique;
alter table users add column if not exists last_login_at timestamptz;

create table if not exists sessions (
    id         char(64) primary key, -- sha256 hex of the cookie token
    user_id    integer not null references users on delete cascade,
    created_at timestamptz not null default current_timestamp,
    expires_at timestamptz not null
);

create index if not exists sessions_user_idx on sessions (user_id);
