-- Station modes, app-side calibration, and the bucket tipped alert.
--
-- mode: normal       a sudden drop means the bucket tipped (critical alert, and an email if set up)
--       collection   someone is emptying it: a drop is logged as a collection, no alert
--       maintenance  someone is working on it: weight changes count for nothing and raise no alerts
-- Collection and maintenance switch back to normal at mode_until, so a forgotten toggle cannot
-- silence the tipped alert for good.
alter table buckets add column if not exists mode       varchar(20) not null default 'normal';
alter table buckets add column if not exists mode_until timestamptz;
-- Multiplies the net weight (reading minus tare) the node reports; set from known weights.
alter table buckets add column if not exists calibration_factor numeric(8, 5) not null default 1;

-- Known weights put on the scale (e.g. gym plates) and what the scale read at the time.
create table if not exists calibration_points (
    id          integer generated always as identity primary key,
    bucket_id   integer not null references buckets on delete cascade,
    known_kg    numeric(7, 3) not null,
    measured_kg numeric(7, 3) not null, -- net of tare, before calibration_factor
    created_at  timestamptz not null default current_timestamp
);
create index if not exists calibration_points_bucket_idx on calibration_points (bucket_id, created_at);
