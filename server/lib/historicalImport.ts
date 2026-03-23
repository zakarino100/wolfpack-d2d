import fs from "fs";
import path from "path";
import { supabase } from "./supabase";
import { parseCSV } from "./csvParser";

// ─── Constants ────────────────────────────────────────────────────────────────

const IMPORT_SOURCE = "Wolf Pack Wash leads historical import";
const IMPORT_BRANCH = "Wolf Pack Wash";
const IMPORT_BATCH = "airtable-wpw-2025";
const IMPORT_LEAD_YEAR = 2025;
const HISTORICAL_STATUS_PURCHASED = "completed"; // is_purchased + is_serviced → completed
const HISTORICAL_STATUS_SOLD = "sold";           // is_purchased only → sold
const HISTORICAL_STATUS_QUOTED = "quote_given";  // has a quote amount → quoted
const HISTORICAL_STATUS_DEFAULT = "new";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  fullAddress: string;
  city: string;
  zip: string;
  phoneRaw: string;
  phoneNormalized: string;
  email: string;
  services: string[];
  isPurchased: boolean;
  isServiced: boolean;
  streaklessWindows: boolean;
  smsConsent: boolean;
  createdAtAirtable: string | null;
  scheduledDate: string | null;
  servicedOn: string | null;
  soldDate: string | null;
  assignedRep: string;
  serviceNotes: string;
  conversationNotes: string;
  houseSquft: number | null;
  cementSqft: number | null;
  windowsCount: number | null;
  linearFt: number | null;
  frequency: string;
  totalQuote: number | null;
  leadSourceOriginal: string;
  preferredContact: string;
  airtableQuoteId: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ImportReport {
  total: number;
  skippedBotRows: number;
  skippedBlankRows: number;
  skippedNoAddress: number;
  duplicates: Array<{ rowIndex: number; name: string; address: string; existingId: string }>;
  geocodingFailures: Array<{ rowIndex: number; address: string; reason: string }>;
  parseIssues: Array<{ rowIndex: number; field: string; raw: string; issue: string }>;
  toInsert: number;
  insertedIds: string[];
  dryRun: boolean;
  errors: string[];
}

// ─── Phone normalization ──────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  if (!raw.trim()) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return digits.length >= 7 ? `+1${digits.slice(-10)}` : "";
}

// ─── Parse date helpers ───────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  if (!raw.trim()) return null;
  // Airtable dates: M/D/YYYY, M/D/YYYY H:MMam, etc.
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function parseDateTime(raw: string): string | null {
  if (!raw.trim()) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ─── Checked field parser ─────────────────────────────────────────────────────

function parseChecked(val: string): boolean {
  return val.toLowerCase().trim() === "checked";
}

// ─── Parse integer ────────────────────────────────────────────────────────────

function parseInteger(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n;
}

// ─── Parse decimal ────────────────────────────────────────────────────────────

function parseDecimal(raw: string): number | null {
  if (!raw.trim()) return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ─── Parse services array ─────────────────────────────────────────────────────

function parseServices(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Normalize address to single line ────────────────────────────────────────

function normalizeAddress(raw: string, city: string, zip: string): string {
  // Replace embedded newlines with spaces
  let addr = raw.replace(/[\r\n]+/g, ", ").replace(/,\s*,/g, ",").trim();
  // If city not in address, append it
  if (city && !addr.toLowerCase().includes(city.toLowerCase())) {
    addr = `${addr}, ${city}`;
  }
  if (zip && !addr.includes(zip)) {
    addr = `${addr} ${zip}`;
  }
  return addr;
}

// ─── Geocode via Google Maps ──────────────────────────────────────────────────

async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: string;
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };
    if (data.status !== "OK" || !data.results.length) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

// ─── Determine lead status ────────────────────────────────────────────────────

function deriveStatus(row: ImportRow): string {
  if (row.isPurchased && row.isServiced) return HISTORICAL_STATUS_PURCHASED;
  if (row.isPurchased) return HISTORICAL_STATUS_SOLD;
  if (row.totalQuote !== null && row.totalQuote > 0) return HISTORICAL_STATUS_QUOTED;
  return HISTORICAL_STATUS_DEFAULT;
}

// ─── Main import function ─────────────────────────────────────────────────────

export async function runHistoricalImport(
  dryRun: boolean,
  progressCallback?: (msg: string) => void
): Promise<ImportReport> {
  const log = progressCallback ?? (() => {});

  const report: ImportReport = {
    total: 0,
    skippedBotRows: 0,
    skippedBlankRows: 0,
    skippedNoAddress: 0,
    duplicates: [],
    geocodingFailures: [],
    parseIssues: [],
    toInsert: 0,
    insertedIds: [],
    dryRun,
    errors: [],
  };

  // ── Load CSV ────────────────────────────────────────────────────────────────
  const csvPath = path.join(process.cwd(), "server/data/historical-wpw.csv");
  if (!fs.existsSync(csvPath)) {
    report.errors.push("CSV file not found at server/data/historical-wpw.csv");
    return report;
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  log("CSV loaded, parsing rows...");
  const rawRows = parseCSV(content);
  log(`Parsed ${rawRows.length} raw rows`);

  // ── Filter bot/blank rows ───────────────────────────────────────────────────
  const validRows: { raw: Record<string, string>; rowIndex: number }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const firstName = (r["First Name"] ?? "").trim();

    // Bot rows: first name starts with "LunaChatBot:" or has Thread ID but no name
    if (
      firstName.startsWith("LunaChatBot:") ||
      firstName.startsWith("Luna") ||
      (!firstName && r["Thread ID"])
    ) {
      report.skippedBotRows++;
      continue;
    }

    // Blank rows
    if (!firstName && !(r["Street Address"] ?? "").trim()) {
      report.skippedBlankRows++;
      continue;
    }

    validRows.push({ raw: r, rowIndex: i + 2 }); // +2 for header and 1-index
  }

  report.total = validRows.length + report.skippedBotRows + report.skippedBlankRows;
  log(`${validRows.length} candidate rows after filtering (${report.skippedBotRows} bot rows, ${report.skippedBlankRows} blank rows skipped)`);

  // ── Load existing leads for dedup ──────────────────────────────────────────
  log("Loading existing leads for deduplication check...");
  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id, address_line1, phone, phone_normalized, airtable_quote_id")
    .eq("is_historical_import", true);

  // Also check current (non-historical) leads by address+phone
  const { data: currentLeads } = await supabase
    .from("leads")
    .select("id, address_line1, phone")
    .eq("is_historical_import", false);

  const existingByAirtableId = new Map<string, string>();
  const existingByAddressPhone = new Map<string, string>();

  for (const lead of existingLeads ?? []) {
    if (lead.airtable_quote_id) {
      existingByAirtableId.set(lead.airtable_quote_id.trim(), lead.id);
    }
    const key = makeDedupeKey(lead.address_line1, lead.phone || lead.phone_normalized || "");
    if (key) existingByAddressPhone.set(key, lead.id);
  }
  for (const lead of currentLeads ?? []) {
    const key = makeDedupeKey(lead.address_line1, lead.phone ?? "");
    if (key) existingByAddressPhone.set(key, lead.id);
  }

  log(`Dedup index built: ${existingByAirtableId.size} existing historical, ${existingByAddressPhone.size} by address+phone`);

  // ── Process each row ────────────────────────────────────────────────────────
  const rowsToInsert: ImportRow[] = [];

  for (const { raw: r, rowIndex } of validRows) {
    const firstName = (r["First Name"] ?? "").trim();
    const lastName = (r["Last Name"] ?? "").trim();
    const rawAddress = (r["Street Address"] ?? "").trim();
    const city = (r["City"] ?? "").trim();
    const zip = (r["Zip Code"] ?? "").trim();

    // No address at all
    if (!rawAddress) {
      report.skippedNoAddress++;
      continue;
    }

    const fullAddress = normalizeAddress(rawAddress, city, zip);
    const phoneRaw = (r["Phone Number"] ?? "").trim();
    const phoneNormalized = normalizePhone(phoneRaw);
    const airtableQuoteId = (r["Quote ID"] ?? "").trim();

    // Parse dates
    const createdAtAirtable = parseDateTime(r["Created Time"] ?? "");
    const scheduledDate = parseDate(r["Scheduled"] ?? "");
    const servicedOn = parseDate(r["ServicedOn"] ?? "");
    const soldDate = parseDate(r["Sold Date"] ?? "");

    // Numeric fields
    const houseSquft = parseInteger(r["House Sqft"] ?? "");
    const cementSqft = parseInteger(r["Cement Sqft"] ?? "");
    const windowsCount = parseInteger(r["Windows Count"] ?? "");
    const linearFt = parseInteger(r["Linear Ft"] ?? "");
    const totalQuote = parseDecimal(r["Total Quote"] ?? "");

    if (totalQuote === null && (r["Total Quote"] ?? "").trim()) {
      report.parseIssues.push({
        rowIndex,
        field: "Total Quote",
        raw: r["Total Quote"] ?? "",
        issue: "Could not parse as decimal",
      });
    }

    const importRow: ImportRow = {
      rowIndex,
      firstName,
      lastName,
      fullAddress,
      city,
      zip,
      phoneRaw,
      phoneNormalized,
      email: (r["Email Address"] ?? "").trim().toLowerCase(),
      services: parseServices(r["Services Selected"] ?? ""),
      isPurchased: parseChecked(r["Purchased"] ?? ""),
      isServiced: parseChecked(r["Serviced"] ?? ""),
      streaklessWindows: parseChecked(r["Streakless Windows (Y/N)"] ?? ""),
      smsConsent: parseChecked(r["Consent to sms"] ?? ""),
      createdAtAirtable,
      scheduledDate,
      servicedOn,
      soldDate,
      assignedRep: (r["Assigned Employee"] ?? "").trim(),
      serviceNotes: (r["Service Notes"] ?? "").trim(),
      conversationNotes: (r["Conversation Notes"] ?? "").trim(),
      houseSquft,
      cementSqft,
      windowsCount,
      linearFt,
      frequency: (r["Frequency"] ?? "").trim(),
      totalQuote,
      leadSourceOriginal: (r["Came from"] ?? "").trim(),
      preferredContact: (r["PreferredContact"] ?? "").trim(),
      airtableQuoteId,
      latitude: null,
      longitude: null,
    };

    // ── Deduplication ─────────────────────────────────────────────────────────
    if (airtableQuoteId && existingByAirtableId.has(airtableQuoteId)) {
      report.duplicates.push({
        rowIndex,
        name: `${firstName} ${lastName}`.trim(),
        address: fullAddress,
        existingId: existingByAirtableId.get(airtableQuoteId)!,
      });
      continue;
    }

    const dedupeKey = makeDedupeKey(fullAddress, phoneNormalized);
    if (dedupeKey && existingByAddressPhone.has(dedupeKey)) {
      report.duplicates.push({
        rowIndex,
        name: `${firstName} ${lastName}`.trim(),
        address: fullAddress,
        existingId: existingByAddressPhone.get(dedupeKey)!,
      });
      continue;
    }

    rowsToInsert.push(importRow);
  }

  log(`${rowsToInsert.length} rows to insert, ${report.duplicates.length} duplicates skipped`);
  report.toInsert = rowsToInsert.length;

  // ── Geocoding (always run for reporting even in dry-run) ──────────────────
  log("Geocoding addresses...");
  const GEOCODE_DELAY_MS = 50; // avoid rate limits
  for (const row of rowsToInsert) {
    const coords = await geocodeAddress(row.fullAddress);
    if (!coords) {
      report.geocodingFailures.push({
        rowIndex: row.rowIndex,
        address: row.fullAddress,
        reason: "No result from geocoding API",
      });
    } else {
      row.latitude = coords.lat;
      row.longitude = coords.lng;
    }
    await sleep(GEOCODE_DELAY_MS);
  }
  log(`Geocoding done: ${rowsToInsert.filter((r) => r.latitude !== null).length} succeeded, ${report.geocodingFailures.length} failed`);

  // ── Dry run stops here ────────────────────────────────────────────────────
  if (dryRun) {
    log("DRY RUN complete — no writes performed");
    return report;
  }

  // ── Real insert ────────────────────────────────────────────────────────────
  log(`Inserting ${rowsToInsert.length} leads into Supabase...`);

  const BATCH_SIZE = 25;
  for (let b = 0; b < rowsToInsert.length; b += BATCH_SIZE) {
    const batch = rowsToInsert.slice(b, b + BATCH_SIZE);
    const records = batch.map((row) => buildLeadRecord(row));

    const { data: inserted, error } = await supabase
      .from("leads")
      .insert(records)
      .select("id");

    if (error) {
      report.errors.push(`Batch ${b}-${b + BATCH_SIZE}: ${error.message}`);
      log(`Batch error: ${error.message}`);
    } else {
      const ids = (inserted ?? []).map((r: { id: string }) => r.id);
      report.insertedIds.push(...ids);

      // For each geocoded lead, insert a pin and then update lead.pin_id
      let pinsCreated = 0;
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const leadId = ids[i];
        if (!leadId || row.latitude === null || row.longitude === null) continue;

        const { data: pinData, error: pinError } = await supabase
          .from("pins")
          .insert({
            title: `${row.firstName} ${row.lastName}`.trim() || row.fullAddress,
            address_line1: row.fullAddress,
            city: row.city || null,
            state: "NC",
            zip: row.zip || null,
            latitude: row.latitude,
            longitude: row.longitude,
            status: deriveStatus(row),
            created_by: "historical_import",
            business_unit: "Healthy Home",
            notes: row.serviceNotes || null,
          })
          .select("id")
          .single();

        if (pinError) {
          log(`Pin insert warning for row ${row.rowIndex}: ${pinError.message}`);
          continue;
        }

        if (pinData?.id) {
          // Link pin to lead
          await supabase
            .from("leads")
            .update({ pin_id: pinData.id })
            .eq("id", leadId);
          pinsCreated++;
        }
      }

      log(`Batch inserted: ${ids.length} leads, ${pinsCreated} pins`);
    }
  }

  log(`Import complete. ${report.insertedIds.length} leads inserted.`);
  return report;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDedupeKey(address: string, phone: string): string {
  const a = (address ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
  const p = (phone ?? "").replace(/\D/g, "").slice(-10);
  if (!a && !p) return "";
  return `${a}|${p}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLeadRecord(row: ImportRow): Record<string, unknown> {
  const name = `${row.firstName} ${row.lastName}`.trim();
  const status = deriveStatus(row);

  return {
    // Identity
    homeowner_name: name || null,
    phone: row.phoneNormalized || row.phoneRaw || null,
    phone_raw: row.phoneRaw || null,
    phone_normalized: row.phoneNormalized || null,
    email: row.email || null,

    // Address
    address_line1: row.fullAddress,
    full_address: row.fullAddress,
    city: row.city || null,
    state: null,
    zip: row.zip || null,
    latitude: row.latitude,
    longitude: row.longitude,

    // Status
    status,

    // Services
    services_interested: row.services.length > 0 ? row.services : null,

    // Historical import tags (hard-coded per spec)
    source: IMPORT_SOURCE,
    branch: IMPORT_BRANCH,
    is_historical_import: true,
    import_batch: IMPORT_BATCH,
    imported_from_csv: true,
    lead_year: IMPORT_LEAD_YEAR,
    business_unit: "Healthy Home",

    // Airtable data
    airtable_quote_id: row.airtableQuoteId || null,
    created_at_airtable: row.createdAtAirtable || null,
    created_at: row.createdAtAirtable || new Date().toISOString(),

    // Scheduling
    assigned_rep: row.assignedRep || null,
    scheduled_date: row.scheduledDate || null,
    serviced_on: row.servicedOn || null,
    sold_date: row.soldDate || null,

    // Source
    lead_source_original: row.leadSourceOriginal || null,

    // Quote
    frequency: row.frequency || null,
    total_quote: row.totalQuote,

    // Flags
    is_purchased: row.isPurchased,
    is_serviced: row.isServiced,
    streakless_windows: row.streaklessWindows,
    sms_consent: row.smsConsent,

    // Measurements
    house_sqft: row.houseSquft,
    cement_sqft: row.cementSqft,
    windows_count: row.windowsCount,
    linear_ft: row.linearFt,
    exact_square_footage: null,

    // Notes
    service_notes: row.serviceNotes || null,
    conversation_notes: row.conversationNotes || null,

    // Contact
    preferred_contact: row.preferredContact || null,

    // Timestamps
    last_touch_at: row.createdAtAirtable || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
