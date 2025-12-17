-- Core tables as per V1 spec

create table if not exists leads (
  lead_id text primary key,
  vin text not null,
  dealer_id text not null,
  dealer_zip text not null,
  lead_type text null,
  status text not null default 'new', -- new/processing/scored/failed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_dealer on leads(dealer_id);
create index if not exists idx_leads_status on leads(status);

create table if not exists zip_geo (
  zip text primary key,
  lat double precision not null,
  lon double precision not null,
  state text null,
  updated_at timestamptz not null default now()
);

create table if not exists vehicle_facts (
  vin text primary key,
  model_year int null,
  make text null,
  model text null,
  decoded_json jsonb not null default '{}'::jsonb,
  decoded_at timestamptz not null default now()
);

create table if not exists vehicle_recalls (
  vin text primary key,
  open_recall_count int not null default 0,
  recalls_json jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz not null default now()
);

create table if not exists weather_daily (
  geo_key text not null,
  date date not null,
  provider text not null,
  tmin_f real null,
  tmax_f real null,
  precip_mm real null,
  snow_mm real null,
  raw_json jsonb not null default '{}'::jsonb,
  primary key (geo_key, date, provider)
);

create index if not exists idx_weather_daily_geo on weather_daily(geo_key, date);

create table if not exists weather_forecast_hourly (
  geo_key text not null,
  forecast_time_utc timestamptz not null,
  provider text not null,
  temp_f real null,
  precip_prob real null,
  ice_risk_flag boolean null,
  raw_json jsonb not null default '{}'::jsonb,
  primary key (geo_key, forecast_time_utc, provider)
);

create index if not exists idx_weather_forecast_geo on weather_forecast_hourly(geo_key, forecast_time_utc);

create table if not exists weather_alerts (
  geo_key text not null,
  alert_id text not null,
  severity text null,
  event text null,
  effective_utc timestamptz null,
  expires_utc timestamptz null,
  raw_json jsonb not null default '{}'::jsonb,
  primary key (geo_key, alert_id)
);

create index if not exists idx_weather_alerts_geo on weather_alerts(geo_key);

create extension if not exists "uuid-ossp";

create table if not exists feature_vectors (
  feature_vector_id uuid primary key default uuid_generate_v4(),
  lead_id text not null references leads(lead_id) on delete cascade,
  vin text not null,
  dealer_zip text not null,
  run_date date not null,
  feature_version text not null,
  features jsonb not null,
  inputs jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feature_vectors_lead on feature_vectors(lead_id, run_date desc);

create table if not exists lead_scores (
  lead_id text primary key references leads(lead_id) on delete cascade,
  priority_score int not null,
  bucket text not null,
  reasons text[] not null,
  score_version text not null,
  scored_at timestamptz not null default now()
);

create table if not exists lead_events (
  event_id uuid primary key default uuid_generate_v4(),
  lead_id text not null,
  dealer_id text not null,
  event_type text not null,
  event_ts timestamptz not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_lead_events_lead on lead_events(lead_id, event_ts desc);


