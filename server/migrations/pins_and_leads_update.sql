-- Pins and Leads Update Migration
-- Run this in your Supabase SQL Editor

-- Create pins table
CREATE TABLE IF NOT EXISTS pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  title text NULL,
  notes text NULL,
  address_line1 text NULL,
  city text NULL,
  state text NULL,
  zip text NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  created_by text NOT NULL,
  business_unit text DEFAULT 'wolfpack_wash'
);

-- Add status column to pins table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pins' AND column_name = 'status') THEN
    ALTER TABLE pins ADD COLUMN status text DEFAULT 'new';
  END IF;
END $$;

-- Add pin_id and created_by to leads table if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'pin_id') THEN
    ALTER TABLE leads ADD COLUMN pin_id uuid NULL REFERENCES pins(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'created_by') THEN
    ALTER TABLE leads ADD COLUMN created_by text NULL;
  END IF;
END $$;

-- Create indexes for pins
CREATE INDEX IF NOT EXISTS idx_pins_location ON pins(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_pins_created_by ON pins(created_by);
CREATE INDEX IF NOT EXISTS idx_pins_business_unit ON pins(business_unit);
CREATE INDEX IF NOT EXISTS idx_leads_pin_id ON leads(pin_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);

-- Enable RLS on pins
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "pins_select_policy" ON pins;
DROP POLICY IF EXISTS "pins_insert_policy" ON pins;
DROP POLICY IF EXISTS "pins_update_policy" ON pins;
DROP POLICY IF EXISTS "pins_delete_policy" ON pins;

-- RLS Policies for pins: Everyone can view, only creator can edit/delete
-- For service role access (backend uses service role key)
CREATE POLICY "Service role full access pins" ON pins
  FOR ALL USING (true) WITH CHECK (true);

-- Drop and recreate leads policies for the new fields
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
DROP POLICY IF EXISTS "leads_update_policy" ON leads;

-- Note: Since we use service role key in backend, these policies allow full access
-- Access control is handled at the application level via authMiddleware
