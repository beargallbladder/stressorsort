-- Privacy: reduce VIN sprawl by adding vin_hash
alter table if exists vehicle_facts add column if not exists vin_hash text;
create index if not exists idx_vehicle_facts_vin_hash on vehicle_facts(vin_hash);

alter table if exists vehicle_recalls add column if not exists vin_hash text;
create index if not exists idx_vehicle_recalls_vin_hash on vehicle_recalls(vin_hash);

alter table if exists feature_vectors add column if not exists vin_hash text;
create index if not exists idx_feature_vectors_vin_hash on feature_vectors(vin_hash);

-- A/B variant in lead_scores
alter table if exists lead_scores add column if not exists variant text;

-- NOAA station cache per geo_key
create table if not exists noaa_station_cache (
  geo_key text primary key,
  station_id text not null,
  coverage_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);


