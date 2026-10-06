-- Keys the gateway bridge sends in X-Ingest-Key, one per gateway (a laptop, later the Pi). Only a
-- SHA-256 hash is stored; the key itself is shown once when it is made. A key also fixes the name
-- its gateway reports as, so one bridge cannot pose as another.

create table if not exists gateway_keys (
    id           integer generated always as identity primary key,
    gateway_code varchar(50) not null,                          -- the name readings are stored under
    key_hash     char(64) not null unique,                      -- sha256 hex of the key
    key_prefix   varchar(16) not null,                          -- first characters, to tell keys apart
    created_by   integer references users on delete set null,
    created_at   timestamptz not null default current_timestamp,
    last_used_at timestamptz,
    revoked_at   timestamptz
);
