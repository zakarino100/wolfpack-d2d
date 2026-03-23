-- Healthy Home Field App - Additional Tables
-- Run this in Supabase SQL Editor

-- Add scheduling columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_day text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_time text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scheduling_notes text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sold_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_phone text;

-- Lost reason and status tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason text;

-- Backend sync tracking: stores the ID from the Healthy Home backend CRM
ALTER TABLE leads ADD COLUMN IF NOT EXISTS backend_lead_id integer;

-- Answered-at timestamp on touches (for "Answered" door outcome timing)
ALTER TABLE d2d_touches ADD COLUMN IF NOT EXISTS answered_at timestamptz;

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text NOT NULL,
  rep_id text,
  rep_email text,
  rep_name text,
  name text,
  date date NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'shared', 'in_progress', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Route stops table
CREATE TABLE IF NOT EXISTS route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id),
  stop_order int NOT NULL DEFAULT 0,
  arrival_window text,
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'en_route', 'completed')),
  created_at timestamptz DEFAULT now()
);

-- Rep GPS tracking table
CREATE TABLE IF NOT EXISTS rep_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_email text NOT NULL,
  rep_name text,
  lat float NOT NULL,
  lng float NOT NULL,
  recorded_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_routes_rep_email ON routes(rep_email);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(date);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_lead_id ON route_stops(lead_id);
CREATE INDEX IF NOT EXISTS idx_rep_locations_rep_email ON rep_locations(rep_email);
CREATE INDEX IF NOT EXISTS idx_rep_locations_recorded_at ON rep_locations(recorded_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_sold_at ON leads(sold_at);

-- Enable RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for routes
CREATE POLICY IF NOT EXISTS "routes_select_all" ON routes FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "routes_insert_all" ON routes FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "routes_update_all" ON routes FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "routes_delete_all" ON routes FOR DELETE USING (true);

-- RLS policies for route_stops
CREATE POLICY IF NOT EXISTS "route_stops_select_all" ON route_stops FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "route_stops_insert_all" ON route_stops FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "route_stops_update_all" ON route_stops FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "route_stops_delete_all" ON route_stops FOR DELETE USING (true);

-- RLS policies for rep_locations
CREATE POLICY IF NOT EXISTS "rep_locations_select_all" ON rep_locations FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "rep_locations_insert_all" ON rep_locations FOR INSERT WITH CHECK (true);
