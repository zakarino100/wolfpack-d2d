-- D2D Canvassing App Database Schema
-- Run this in your Supabase SQL Editor

-- Create leads table if not exists
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  source text DEFAULT 'd2d',
  business_unit text DEFAULT 'wolfpack_wash',
  homeowner_name text NULL,
  phone text NULL,
  email text NULL,
  address_line1 text NOT NULL,
  city text NULL,
  state text NULL,
  zip text NULL,
  latitude numeric NULL,
  longitude numeric NULL,
  services_interested text[] NULL,
  tags text[] NULL,
  status text NOT NULL DEFAULT 'new',
  assigned_rep_email text NULL,
  last_touch_at timestamptz NULL,
  next_followup_at timestamptz NULL,
  followup_channel text NULL,
  followup_priority text NULL,
  do_not_knock boolean DEFAULT false
);

-- Create d2d_touches table
CREATE TABLE IF NOT EXISTS d2d_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  rep_email text NOT NULL,
  touch_type text NOT NULL,
  outcome text NOT NULL,
  notes text NULL,
  next_followup_at timestamptz NULL,
  followup_channel text NULL,
  followup_priority text NULL
);

-- Create d2d_quotes table
CREATE TABLE IF NOT EXISTS d2d_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  rep_email text NOT NULL,
  offer_version text NULL,
  quote_amount numeric NULL,
  quote_line_items jsonb NOT NULL DEFAULT '[]',
  estimated_duration_minutes int NULL,
  proposed_timeframe text NULL,
  notes text NULL
);

-- Create d2d_media table
CREATE TABLE IF NOT EXISTS d2d_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  touch_id uuid NULL REFERENCES d2d_touches(id) ON DELETE SET NULL,
  rep_email text NOT NULL,
  type text NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NULL,
  original_filename text NULL,
  size_bytes bigint NULL,
  captured_at timestamptz DEFAULT now()
);

-- Create d2d_services table
CREATE TABLE IF NOT EXISTS d2d_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text DEFAULT 'wolfpack_wash',
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  active boolean DEFAULT true
);

-- Create crm_activity table for CRM integration
CREATE TABLE IF NOT EXISTS crm_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  business_unit text DEFAULT 'wolfpack_wash',
  activity_type text NOT NULL,
  lead_id uuid NULL,
  title text NOT NULL,
  details jsonb NULL,
  actor text NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_business_unit ON leads(business_unit);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_rep ON leads(assigned_rep_email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_at);
CREATE INDEX IF NOT EXISTS idx_leads_address ON leads(address_line1, zip);
CREATE INDEX IF NOT EXISTS idx_leads_location ON leads(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_touches_lead ON d2d_touches(lead_id);
CREATE INDEX IF NOT EXISTS idx_touches_rep ON d2d_touches(rep_email);
CREATE INDEX IF NOT EXISTS idx_touches_created ON d2d_touches(created_at);

CREATE INDEX IF NOT EXISTS idx_quotes_lead ON d2d_quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_media_lead ON d2d_media(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_lead ON crm_activity(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON crm_activity(activity_type);

-- Seed default services
INSERT INTO d2d_services (key, label, business_unit, active) VALUES
  ('house_wash', 'House Wash', 'wolfpack_wash', true),
  ('driveway', 'Driveway/Walkway', 'wolfpack_wash', true),
  ('roof_wash', 'Roof Wash', 'wolfpack_wash', true),
  ('gutters', 'Gutters', 'wolfpack_wash', true),
  ('windows', 'Windows', 'wolfpack_wash', true),
  ('deck_fence', 'Deck/Fence', 'wolfpack_wash', true),
  ('other', 'Other', 'wolfpack_wash', true)
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE d2d_touches ENABLE ROW LEVEL SECURITY;
ALTER TABLE d2d_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE d2d_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE d2d_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies for service role (full access)
-- Note: These policies allow the service role to bypass RLS
-- Client-side access is handled by the server with auth middleware

CREATE POLICY "Service role full access leads" ON leads
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access touches" ON d2d_touches
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access quotes" ON d2d_quotes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access media" ON d2d_media
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access services" ON d2d_services
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access activity" ON crm_activity
  FOR ALL USING (true) WITH CHECK (true);
