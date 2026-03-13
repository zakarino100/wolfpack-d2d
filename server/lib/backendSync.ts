const BACKEND_URL =
  process.env.HH_BACKEND_URL || "https://healthy-home-backend.replit.app";

type BackendLeadStatus = "new" | "quoted" | "follow_up" | "sold" | "lost";

function mapStatus(status: string): BackendLeadStatus {
  const map: Record<string, BackendLeadStatus> = {
    not_home: "new",
    no_answer: "new",
    not_interested: "lost",
    do_not_knock: "lost",
    follow_up: "follow_up",
    booked: "follow_up",
    contacted: "quoted",
    interested: "quoted",
    quoted: "quoted",
    sold: "sold",
    completed: "sold",
  };
  return map[status] || "new";
}

function parseName(fullName?: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: "Unknown", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] || "Unknown", lastName: parts.slice(1).join(" ") };
}

export async function syncLeadToBackend(
  lead: Record<string, any>,
  canvasser: string,
  quoteAmount?: string
): Promise<number | null> {
  try {
    const { firstName, lastName } = parseName(lead.homeowner_name);
    const addressRaw: string = lead.address_line1 || "";
    const addressParts = addressRaw.split(",");

    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      source: "d2d",
      canvasser,
      status: mapStatus(lead.status || "new"),
    };

    if (lead.phone) payload.phone = lead.phone;
    if (lead.email) payload.email = lead.email;
    if (addressParts[0]) payload.address = addressParts[0].trim();
    if (lead.city || addressParts[1]) payload.city = lead.city || addressParts[1]?.trim();
    if (lead.state) payload.state = lead.state;
    if (lead.zip) payload.zip = lead.zip;
    if (quoteAmount) payload.quoteAmount = quoteAmount;
    if (lead.services_interested) {
      payload.serviceInterest = Array.isArray(lead.services_interested)
        ? lead.services_interested.join(" + ")
        : lead.services_interested;
    }
    if (lead.next_followup_at) {
      payload.followUpDate = String(lead.next_followup_at).split("T")[0];
    }
    if (lead.notes) payload.notes = lead.notes;

    const backendId = lead.backend_lead_id;

    if (backendId) {
      const res = await fetch(`${BACKEND_URL}/api/canvassing/leads/${backendId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        return (json as any).lead?.id ?? (json as any).id ?? backendId;
      }
    } else {
      const res = await fetch(`${BACKEND_URL}/api/canvassing/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        return (json as any).lead?.id ?? (json as any).id ?? null;
      }
    }

    return null;
  } catch (err: any) {
    console.warn("[backendSync] Lead sync failed:", err?.message);
    return null;
  }
}

export async function convertLeadInBackend(backendLeadId: number): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/canvassing/leads/${backendLeadId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err: any) {
    console.warn("[backendSync] Convert lead failed:", err?.message);
  }
}

export async function syncSessionToBackend(params: {
  canvasser: string;
  date: string;
  neighborhood?: string;
  doorsKnocked: number;
  peopleReached: number;
  quotesGiven: number;
  closes: number;
  revenueSold: string;
  notes?: string;
}): Promise<number | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/canvassing/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canvasser: params.canvasser,
        sessionDate: params.date,
        neighborhood: params.neighborhood,
        doorsKnocked: params.doorsKnocked,
        peopleReached: params.peopleReached,
        goodConversations: Math.max(0, Math.round(params.peopleReached * 0.5)),
        quotesGiven: params.quotesGiven,
        closes: params.closes,
        revenueSold: params.revenueSold,
        bundleCount: 0,
        driveawayAddOnCount: 0,
        notes: params.notes,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const json = await res.json();
      return (json as any).session?.id ?? null;
    }
    return null;
  } catch (err: any) {
    console.warn("[backendSync] Session sync failed:", err?.message);
    return null;
  }
}

export async function fetchBackendDashboard(): Promise<{
  today: Record<string, unknown> | null;
  weekly: Record<string, unknown> | null;
}> {
  try {
    const [todayRes, weeklyRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/dashboard/today`, { signal: AbortSignal.timeout(8000) }),
      fetch(`${BACKEND_URL}/api/dashboard/weekly`, { signal: AbortSignal.timeout(8000) }),
    ]);
    const today = todayRes.ok ? await todayRes.json() : null;
    const weekly = weeklyRes.ok ? await weeklyRes.json() : null;
    return { today, weekly };
  } catch (err: any) {
    console.warn("[backendSync] Dashboard fetch failed:", err?.message);
    return { today: null, weekly: null };
  }
}
