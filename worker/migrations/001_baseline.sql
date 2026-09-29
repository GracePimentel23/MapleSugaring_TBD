-- Shared class baseline DDL (the same tables as web/lib/types/schema.ts and 7BS's 001_baseline.sql),
-- made re-runnable with IF NOT EXISTS. Keep this file comparable to the class DDL; changes go in 002+.

create table if not exists roles (
    id        integer generated always as identity primary key,
    role_name varchar(50) not null unique
);

create table if not exists users (
    id         integer generated always as identity primary key,
    role_id    integer references roles,
    full_name  varchar(100) not null,
    email      varchar(255) not null unique,
    created_at timestamptz default current_timestamp
);

create table if not exists gateway (
    id           integer generated always as identity primary key,
    gateway_code varchar(50) not null unique,
    ip_address   varchar(45),
    status       varchar(20) default 'active',
    last_ping    timestamptz
);

create table if not exists node (
    id            integer generated always as identity primary key,
    gateway_id    integer references gateway,
    node_code     varchar(50) not null unique,
    battery_level numeric(5, 2),
    status        varchar(20) default 'active',
    installed_at  timestamptz default current_timestamp
);

create table if not exists buckets (
    id              integer generated always as identity primary key,
    node_id         integer references node,
    capacity_liters numeric(6, 2),
    tree_species    varchar(50),
    installed_at    timestamptz default current_timestamp
);

create table if not exists alerts (
    id          integer generated always as identity primary key,
    node_id     integer references node,
    alert_type  varchar(50) not null,
    severity    varchar(20) default 'warning',
    message     text,
    is_resolved boolean default false,
    created_at  timestamptz default current_timestamp
);

create table if not exists collection_logs (
    id                      integer generated always as identity primary key,
    user_id                 integer references users on delete set null,
    node_id                 integer references node,
    bucket_id               integer references buckets,
    volume_collected_liters numeric(6, 2) not null,
    collected_at            timestamptz default current_timestamp
);

create table if not exists metrics (
    id                  integer generated always as identity primary key,
    recorded_by_user_id integer references users on delete set null,
    node_id             integer references node,
    bucket_id           integer references buckets,
    fill_level_percent  numeric(5, 2),
    sap_flow_rate_lph   numeric(6, 2),
    recorded_at         timestamptz default current_timestamp
);
