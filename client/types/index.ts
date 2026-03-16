export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  source: string;
  business_unit: string;
  homeowner_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  services_interested: string[] | null;
  tags: string[] | null;
  status: LeadStatus;
  assigned_rep_email: string | null;
  created_by: string | null;
  pin_id: string | null;
  last_touch_at: string | null;
  next_followup_at: string | null;
  followup_channel: FollowupChannel | null;
  followup_priority: FollowupPriority | null;
  do_not_knock: boolean;
  preferred_day: string | null;
  preferred_time: string | null;
  scheduling_notes: string | null;
  sold_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
}

export type LeadStatus =
  | "knocked_no_answer"
  | "not_home"
  | "inaccessible"
  | "do_not_knock"
  | "not_interested"
  | "revisit_needed"
  | "follow_up"
  | "callback_set"
  | "quote_given"
  | "estimate_scheduled"
  | "sold"
  | "won"
  | "lost"
  | "completed";

export type TouchType = "knock" | "call" | "text" | "note";

export type TouchOutcome = LeadStatus;

export type FollowupChannel = "call" | "text" | "knock";

export type FollowupPriority = "low" | "med" | "high";

export interface Touch {
  id: string;
  created_at: string;
  lead_id: string;
  rep_email: string;
  touch_type: TouchType;
  outcome: TouchOutcome;
  notes: string | null;
  next_followup_at: string | null;
  followup_channel: FollowupChannel | null;
  followup_priority: FollowupPriority | null;
}

export interface QuoteLineItem {
  service: string;
  price: number;
  sqft: number | null;
  notes: string;
}

export interface Quote {
  id: string;
  created_at: string;
  lead_id: string;
  rep_email: string;
  offer_version: string | null;
  quote_amount: number | null;
  quote_line_items: QuoteLineItem[];
  estimated_duration_minutes: number | null;
  proposed_timeframe: string | null;
  notes: string | null;
}

export interface Media {
  id: string;
  created_at: string;
  lead_id: string;
  touch_id: string | null;
  rep_email: string;
  type: "image" | "video";
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  original_filename: string | null;
  size_bytes: number | null;
  captured_at: string;
  signed_url?: string;
}

export interface Service {
  id: string;
  business_unit: string;
  key: string;
  label: string;
  active: boolean;
}

export interface User {
  email: string;
  name: string;
  picture: string | null;
  role: "admin" | "rep";
}

export interface TouchFormData {
  outcome: TouchOutcome;
  homeowner_name: string;
  phone: string;
  email: string;
  services_interested: string[];
  quote_line_items: QuoteLineItem[];
  next_followup_at: Date | null;
  followup_channel: FollowupChannel | null;
  followup_priority: FollowupPriority | null;
  notes: string;
}

export interface AddressData {
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
}

export interface PendingSync {
  id: string;
  type: "touch" | "quote" | "media";
  payload: unknown;
  created_at: string;
  retries: number;
}

export interface Pin {
  id: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  notes: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number;
  longitude: number;
  created_by: string;
  business_unit: string;
  status: string | null;
  lead?: Lead | null;
}

export interface Route {
  id: string;
  admin_id: string;
  rep_id: string | null;
  rep_email: string | null;
  rep_name: string | null;
  name: string | null;
  date: string;
  status: RouteStatus;
  created_at: string;
  stops?: RouteStop[];
}

export type RouteStatus = "draft" | "shared" | "in_progress" | "completed";

export interface RouteStop {
  id: string;
  route_id: string;
  lead_id: string;
  stop_order: number;
  arrival_window: string | null;
  notes: string | null;
  status: StopStatus;
  lead?: Lead | null;
}

export type StopStatus = "pending" | "en_route" | "completed";

export interface RepLocation {
  id: string;
  rep_id: string;
  rep_email: string;
  rep_name: string | null;
  lat: number;
  lng: number;
  recorded_at: string;
}

export interface AnalyticsSummary {
  total_doors: number;
  total_leads: number;
  total_sold: number;
  total_completed: number;
  conversion_rate: number;
}

export interface RepAnalytics {
  rep_email: string;
  rep_name: string | null;
  doors: number;
  leads: number;
  sold: number;
  conversion_rate: number;
}
