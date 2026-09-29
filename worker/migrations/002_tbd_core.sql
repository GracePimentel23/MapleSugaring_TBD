-- TBD additions on top of the class baseline: load cell ingest, stations, collections and batches.
--
-- Units: weights are kilograms (the load cell and firmware speak kg); the API converts to pounds for
-- the UI. Like the UI, sap is treated as 1 kg per liter, so capacity_liters doubles as capacity in kg.
--
-- Node packet (LoRa): {"id":"LC01","k":"live","s":17,"w":3.412,"r":151234,"hx":1}
-- Gateway line (USB): {"type":"packet","n":12,"rssi":-45.0,"snr":9.8,"len":61,"crc":true,"raw":"{...}"}

-- A sap season is named for the calendar year it runs in, so July onward belongs to next year's season.
-- Fixed to UTC so the function is immutable and can be indexed (same rule 7BS uses).
create or replace function sap_season(ts timestamptz) returns integer
  language sql immutable parallel safe as $$
  select case when extract(month from ts at time zone 'UTC') >= 7
              then extract(year from ts at time zone 'UTC')::integer + 1
              else extract(year from ts at time zone 'UTC')::integer end
$$;

-- gateway ---------------------------------------------------------------------------------------
alter table gateway add column if not exists gateway_name varchar(100);
alter table gateway add column if not exists last_seen    timestamptz;
alter table gateway add column if not exists packets_heard integer not null default 0;

-- node: LoRa identity and last known radio / sensor state ---------------------------------------
alter table node add column if not exists node_name     varchar(100);
alter table node add column if not exists last_seen     timestamptz;
alter table node add column if not exists last_rssi     numeric(6, 1);
alter table node add column if not exists last_snr      numeric(5, 1);
alter table node add column if not exists last_seq      integer;
alter table node add column if not exists packets_received integer not null default 0;
alter table node add column if not exists packets_lost  integer not null default 0;
alter table node add column if not exists battery_v     numeric(4, 2);
alter table node add column if not exists hx_ok         boolean;
alter table node add column if not exists calibrated    boolean;

-- buckets: the thing a station card shows -----------------------------------------------------
alter table buckets add column if not exists label    varchar(100);
alter table buckets add column if not exists location varchar(100);
alter table buckets add column if not exists tare_kg  numeric(6, 3) not null default 0;
alter table buckets alter column capacity_liters set default 11.36; -- 3 US gallons

create index if not exists buckets_node_idx on buckets (node_id);

-- raw_packets: everything the gateway heard, before parsing -----------------------------------
create table if not exists raw_packets (
    id           bigint generated always as identity primary key,
    gateway_id   integer references gateway,
    received_at  timestamptz not null default current_timestamp,
    gateway_seq  integer,
    rssi         numeric(6, 1),
    snr          numeric(5, 1),
    crc_ok       boolean,
    raw          text not null,
    parsed_ok    boolean not null default false,
    error        text
);
create index if not exists raw_packets_received_idx on raw_packets (received_at desc);

-- readings: one row per parsed node packet, the source of truth for weight -----------------------
create table if not exists readings (
    id            bigint generated always as identity primary key,
    packet_id     bigint references raw_packets on delete set null,
    node_id       integer not null references node,
    bucket_id     integer references buckets on delete set null,
    measured_at   timestamptz not null,
    kind          varchar(8) not null check (kind in ('live', 'test', 'nohx')),
    seq           integer,
    weight_kg     numeric(7, 3),
    raw_counts    integer,
    uncalibrated  boolean not null default false,
    temperature_c numeric(5, 2)
);
-- The bridge re-sends the same received_at when it retries, so this makes ingest idempotent.
create unique index if not exists readings_dedupe_key on readings (node_id, seq, measured_at);
create index if not exists readings_node_time_idx   on readings (node_id, measured_at desc);
create index if not exists readings_bucket_time_idx on readings (bucket_id, measured_at desc);
create index if not exists readings_season_idx      on readings (sap_season(measured_at));

-- metrics: baseline table, written by the worker at most every METRIC_INTERVAL per bucket ------
create index if not exists metrics_bucket_time_idx on metrics (bucket_id, recorded_at desc);

-- batches: one boil ------------------------------------------------------------------------------
create table if not exists batches (
    id            integer generated always as identity primary key,
    batch_number  varchar(50) not null unique,
    started_on    date not null default current_date,
    status        varchar(12) not null default 'active'
                  check (status in ('completed', 'processing', 'active', 'waiting')),
    sap_in_kg     numeric(8, 2),        -- null: sum of the collections assigned to the batch
    syrup_out_kg  numeric(7, 2) not null default 0,
    brix          numeric(4, 1) not null default 0,
    created_by    varchar(100),
    notes         text,
    created_at    timestamptz not null default current_timestamp
);

-- collections: one trip out to empty buckets; its entries live in collection_logs ---------------
create table if not exists collections (
    id            integer generated always as identity primary key,
    collected_on  date not null default current_date,
    batch_id      integer references batches on delete set null,
    logged_by     varchar(100),
    notes         text,
    created_at    timestamptz not null default current_timestamp
);
create index if not exists collections_on_idx on collections (collected_on desc);

alter table collection_logs add column if not exists collection_id integer references collections on delete cascade;
alter table collection_logs add column if not exists collected_by  varchar(100);
alter table collection_logs add column if not exists weight_kg     numeric(7, 3);
alter table collection_logs add column if not exists source        varchar(10) not null default 'manual';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'collection_logs_source_check') then
    alter table collection_logs add constraint collection_logs_source_check check (source in ('manual', 'auto'));
  end if;
end $$;
create index if not exists collection_logs_time_idx on collection_logs (collected_at desc);
create index if not exists collection_logs_collection_idx on collection_logs (collection_id);

-- alerts: bucket link and at most one open alert per condition --------------------------------
alter table alerts add column if not exists bucket_id   integer references buckets on delete set null;
alter table alerts add column if not exists dedupe_key  varchar(100);
alter table alerts add column if not exists resolved_at timestamptz;
create unique index if not exists alerts_open_dedupe_key on alerts (dedupe_key) where is_resolved = false;
create index if not exists alerts_open_idx on alerts (created_at desc) where is_resolved = false;
create index if not exists alerts_node_idx on alerts (node_id);
