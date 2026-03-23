-- Historical Wolf Pack Wash Import Columns
-- Run this in your Supabase SQL Editor (safe to re-run — uses IF NOT EXISTS)

-- Historical import tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_historical_import boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS import_batch text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS imported_from_csv boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_year integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS branch text;

-- Address / geocoding (city, zip already exist; full_address is the raw single-line version)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS full_address text;

-- Square footage fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS house_sqft integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cement_sqft integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS exact_square_footage integer;

-- Phone normalization
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_raw text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_normalized text;

-- Airtable import tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS airtable_quote_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at_airtable timestamptz;

-- Scheduling
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_rep text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS serviced_on date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sold_date date;

-- Source tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source_original text;

-- Quote data
ALTER TABLE leads ADD COLUMN IF NOT EXISTS frequency text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS total_quote numeric(10,2);

-- Status flags
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_purchased boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_serviced boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS streakless_windows boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sms_consent boolean DEFAULT false;

-- Contact preferences
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_contact text;

-- Notes fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_notes text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversation_notes text;

-- Measurements
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linear_ft integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS windows_count integer;

-- Deduplication index: address + phone combo
CREATE INDEX IF NOT EXISTS idx_leads_address_phone ON leads(address_line1, phone);
CREATE INDEX IF NOT EXISTS idx_leads_historical ON leads(is_historical_import);
CREATE INDEX IF NOT EXISTS idx_leads_import_batch ON leads(import_batch);
CREATE INDEX IF NOT EXISTS idx_leads_airtable_id ON leads(airtable_quote_id);
