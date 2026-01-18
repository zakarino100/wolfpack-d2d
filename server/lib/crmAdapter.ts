import { supabase } from "./supabase";

export interface LeadPayload {
  address_line1: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  homeowner_name?: string | null;
  phone?: string | null;
  email?: string | null;
  services_interested?: string[] | null;
  tags?: string[] | null;
  status?: string;
  assigned_rep_email?: string | null;
  next_followup_at?: string | null;
  followup_channel?: string | null;
  followup_priority?: string | null;
  do_not_knock?: boolean;
}

export interface TouchPayload {
  lead_id: string;
  rep_email: string;
  touch_type: string;
  outcome: string;
  notes?: string | null;
  next_followup_at?: string | null;
  followup_channel?: string | null;
  followup_priority?: string | null;
}

export interface QuotePayload {
  lead_id: string;
  rep_email: string;
  offer_version?: string | null;
  quote_amount?: number | null;
  quote_line_items: object[];
  estimated_duration_minutes?: number | null;
  proposed_timeframe?: string | null;
  notes?: string | null;
}

export interface ActivityPayload {
  business_unit?: string;
  activity_type: string;
  lead_id?: string | null;
  title: string;
  details?: object | null;
  actor?: string | null;
}

function normalizeAddress(address: string): string {
  return address.trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return phone;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

export async function findLeadByAddressOrLatLng(
  address_line1: string,
  zip: string | null,
  latitude: number | null,
  longitude: number | null
) {
  const normalizedAddress = normalizeAddress(address_line1);

  if (zip) {
    const { data: exactMatch } = await supabase
      .from("leads")
      .select("*")
      .ilike("address_line1", normalizedAddress)
      .eq("zip", zip)
      .limit(1)
      .single();

    if (exactMatch) return exactMatch;
  }

  if (latitude && longitude) {
    const { data: nearbyLeads } = await supabase
      .from("leads")
      .select("*")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (nearbyLeads) {
      const THRESHOLD_METERS = 30;
      const nearby = nearbyLeads.find((lead) => {
        if (!lead.latitude || !lead.longitude) return false;
        const distance = getDistanceMeters(
          latitude,
          longitude,
          lead.latitude,
          lead.longitude
        );
        return distance <= THRESHOLD_METERS;
      });
      if (nearby) return nearby;
    }
  }

  return null;
}

function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function upsertLead(payload: LeadPayload, repEmail: string) {
  const normalizedData = {
    ...payload,
    address_line1: normalizeAddress(payload.address_line1),
    state: payload.state?.toUpperCase().trim() || null,
    phone: normalizePhone(payload.phone),
    email: normalizeEmail(payload.email),
    source: "d2d",
    business_unit: "wolfpack_wash",
  };

  const existingLead = await findLeadByAddressOrLatLng(
    normalizedData.address_line1,
    normalizedData.zip || null,
    normalizedData.latitude || null,
    normalizedData.longitude || null
  );

  if (existingLead) {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_touch_at: new Date().toISOString(),
    };

    if (normalizedData.homeowner_name) updateData.homeowner_name = normalizedData.homeowner_name;
    if (normalizedData.phone) updateData.phone = normalizedData.phone;
    if (normalizedData.email) updateData.email = normalizedData.email;
    if (normalizedData.services_interested?.length) {
      updateData.services_interested = normalizedData.services_interested;
    }
    if (normalizedData.next_followup_at) updateData.next_followup_at = normalizedData.next_followup_at;
    if (normalizedData.followup_channel) updateData.followup_channel = normalizedData.followup_channel;
    if (normalizedData.followup_priority) updateData.followup_priority = normalizedData.followup_priority;
    if (normalizedData.status) updateData.status = normalizedData.status;
    if (normalizedData.do_not_knock !== undefined) updateData.do_not_knock = normalizedData.do_not_knock;

    const { data, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", existingLead.id)
      .select()
      .single();

    if (error) throw error;
    return { lead: data, isNew: false };
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...normalizedData,
      assigned_rep_email: repEmail,
      last_touch_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return { lead: data, isNew: true };
}

export async function createTouch(payload: TouchPayload) {
  const { data, error } = await supabase
    .from("d2d_touches")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  const updateData: Record<string, unknown> = {
    last_touch_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (payload.next_followup_at) updateData.next_followup_at = payload.next_followup_at;
  if (payload.followup_channel) updateData.followup_channel = payload.followup_channel;
  if (payload.followup_priority) updateData.followup_priority = payload.followup_priority;

  if (payload.outcome === "interested" || payload.outcome === "quoted") {
    if (!payload.next_followup_at) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      updateData.next_followup_at = tomorrow.toISOString();
      updateData.followup_channel = "text";
      updateData.followup_priority = "med";
    }
  }

  if (payload.outcome === "booked") {
    updateData.status = "booked";
    updateData.followup_priority = "high";
  }

  if (payload.outcome === "do_not_knock") {
    updateData.do_not_knock = true;
    updateData.status = "do_not_knock";
  }

  await supabase
    .from("leads")
    .update(updateData)
    .eq("id", payload.lead_id);

  return data;
}

export async function createQuote(payload: QuotePayload) {
  const { data, error } = await supabase
    .from("d2d_quotes")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function logActivity(payload: ActivityPayload) {
  const { data, error } = await supabase
    .from("crm_activity")
    .insert({
      ...payload,
      business_unit: payload.business_unit || "wolfpack_wash",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to log activity:", error);
  }
  return data;
}

export async function getLeads(repEmail: string, isAdmin: boolean) {
  let query = supabase
    .from("leads")
    .select("*")
    .eq("business_unit", "wolfpack_wash")
    .order("last_touch_at", { ascending: false });

  if (!isAdmin) {
    query = query.eq("assigned_rep_email", repEmail);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getLead(leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error) throw error;
  return data;
}

export async function getTouches(leadId: string) {
  const { data, error } = await supabase
    .from("d2d_touches")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getQuotes(leadId: string) {
  const { data, error } = await supabase
    .from("d2d_quotes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getMedia(leadId: string) {
  const { data, error } = await supabase
    .from("d2d_media")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const mediaWithUrls = await Promise.all(
    (data || []).map(async (item) => {
      const { data: signedData } = await supabase.storage
        .from(item.storage_bucket)
        .createSignedUrl(item.storage_path, 3600);

      return {
        ...item,
        signed_url: signedData?.signedUrl || null,
      };
    })
  );

  return mediaWithUrls;
}

export async function getServices() {
  const { data, error } = await supabase
    .from("d2d_services")
    .select("*")
    .eq("business_unit", "wolfpack_wash")
    .eq("active", true)
    .order("label");

  if (error) throw error;
  return data;
}
