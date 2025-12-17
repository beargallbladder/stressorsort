-- Tensor precompute layer

create table if not exists vehicle_classes (
  vehicle_class_id text primary key,
  make text not null,
  model text not null,
  year_start int not null,
  year_end int not null,
  platform_bucket text not null,
  powertrain_bucket text null,
  drivetrain_bucket text null,
  spec_json jsonb not null default '{}'::jsonb,
  embedding float8[] null,
  feature_vector float8[] null,
  version text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_classes_platform on vehicle_classes(platform_bucket);

create table if not exists scenarios (
  scenario_id text primary key,
  bins_json jsonb not null,
  scenario_hash text not null unique,
  version text not null
);

create table if not exists vehicle_scenario_scores (
  vehicle_class_id text not null references vehicle_classes(vehicle_class_id) on delete cascade,
  scenario_id text not null references scenarios(scenario_id) on delete cascade,
  score int not null,
  reasons text[] not null,
  confidence real not null,
  model_version text not null,
  primary key (vehicle_class_id, scenario_id)
);

create table if not exists vehicle_class_neighbors (
  vehicle_class_id text not null references vehicle_classes(vehicle_class_id) on delete cascade,
  neighbor_vehicle_class_id text not null references vehicle_classes(vehicle_class_id) on delete cascade,
  similarity real not null,
  primary key (vehicle_class_id, neighbor_vehicle_class_id)
);


