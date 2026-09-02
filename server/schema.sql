CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('patient', 'operator', 'controller')),
  operator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  birth_date date,
  phone text,
  state char(2),
  comorbidities text[] NOT NULL DEFAULT '{}',
  plan_status text CHECK (plan_status IN ('adimplente', 'inadimplente', 'pendente')),
  in_treatment_plan boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_operator_idx ON profiles(operator_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  disabled_at timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS measurements (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id text,
  systolic integer NOT NULL CHECK (systolic BETWEEN 40 AND 300),
  diastolic integer NOT NULL CHECK (diastolic BETWEEN 20 AND 200),
  heart_rate integer CHECK (heart_rate BETWEEN 20 AND 250),
  mean_arterial_pressure integer,
  source text NOT NULL CHECK (source IN ('ble', 'manual', 'photo')),
  measured_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS measurements_patient_time_idx ON measurements(patient_id, measured_at DESC);

CREATE TABLE IF NOT EXISTS glucose_measurements (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id text,
  value integer NOT NULL CHECK (value BETWEEN 20 AND 800),
  context text NOT NULL CHECK (context IN ('jejum', 'pre_refeicao', 'pos_refeicao', 'aleatorio')),
  source text NOT NULL CHECK (source IN ('ble', 'manual', 'photo')),
  measured_at timestamptz NOT NULL,
  notes text,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS glucose_patient_time_idx ON glucose_measurements(patient_id, measured_at DESC);

CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text NOT NULL,
  frequency text NOT NULL,
  schedule jsonb,
  active boolean NOT NULL DEFAULT true,
  start_date date,
  end_date date,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medications_patient_idx ON medications(patient_id);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  measurement_id uuid REFERENCES measurements(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('urgent', 'attention', 'adherence')),
  rule text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved')),
  created_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  escalated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alerts_patient_status_idx ON alerts(patient_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS alerts_measurement_type_unique_idx
  ON alerts(measurement_id, type) WHERE measurement_id IS NOT NULL;

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id text PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  model text NOT NULL,
  serial_number text,
  last_connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devices_patient_idx ON devices(patient_id);

ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_role text NOT NULL CHECK (from_role IN ('operator', 'patient')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  sent_at timestamptz NOT NULL,
  read boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_conversation_idx ON chat_messages(operator_id, patient_id, sent_at);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS sync_tombstones (
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  patient_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS sync_tombstones_patient_time_idx
  ON sync_tombstones(patient_id, deleted_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  patient_id uuid,
  changed_fields text[] NOT NULL DEFAULT '{}',
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_actor_time_idx ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_patient_time_idx ON audit_logs(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS account_deletions (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  auth_deleted_at timestamptz,
  last_error text
);
