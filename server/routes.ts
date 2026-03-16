import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import cookieParser from "cookie-parser";
import {
  authMiddleware,
  adminMiddleware,
  createToken,
  getUserRole,
  verifyToken,
  UserPayload,
} from "./lib/auth";
import {
  upsertLead,
  createTouch,
  createQuote,
  logActivity,
  getLeads,
  getLead,
  getTouches,
  getQuotes,
  getMedia,
  insertMedia,
  getServices,
  findLeadByAddressOrLatLng,
  createPin,
  updatePin,
  getPin,
  getPins,
  getPinsWithLeads,
  createLeadWithPin,
  canEditPin,
  canEditLead,
} from "./lib/crmAdapter";
import { supabase } from "./lib/supabase";
import {
  syncLeadToBackend,
  convertLeadInBackend,
  syncSessionToBackend,
  fetchBackendDashboard,
} from "./lib/backendSync";

async function runMigrations() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const runSQL = async (sql: string, label: string) => {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      // rpc approach may not work, try direct SQL via pg
    } catch {}
  };

  // Check if pins table exists by trying to query it
  const { data, error } = await supabase
    .from("pins")
    .select("id")
    .limit(1);

  if (error && error.message.includes("does not exist")) {
    console.log("Pins table not found. Creating pins table and updating leads...");

    // Use Supabase's built-in SQL execution endpoint
    const migrationSQL = `
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
        business_unit text DEFAULT 'healthy_home',
        status text DEFAULT 'new'
      );

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'pin_id') THEN
          ALTER TABLE leads ADD COLUMN pin_id uuid NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'created_by') THEN
          ALTER TABLE leads ADD COLUMN created_by text NULL;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_pins_location ON pins(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_pins_created_by ON pins(created_by);
      CREATE INDEX IF NOT EXISTS idx_pins_business_unit ON pins(business_unit);
      CREATE INDEX IF NOT EXISTS idx_leads_pin_id ON leads(pin_id);
    `;

    try {
      const sqlResponse = await fetch(`${supabaseUrl}/sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: migrationSQL }),
      });

      if (sqlResponse.ok) {
        console.log("Migration completed: pins table created successfully");
      } else {
        const errBody = await sqlResponse.text();
        console.log("SQL endpoint returned:", sqlResponse.status, errBody);
        console.log("Please run the migration manually in Supabase SQL Editor:");
        console.log("Copy contents of server/migrations/pins_and_leads_update.sql");
      }
    } catch (sqlErr) {
      console.log("Could not auto-run migration. Please run manually in Supabase SQL Editor:");
      console.log("Copy contents of server/migrations/pins_and_leads_update.sql");
    }
  } else {
    // Pins table exists, check for status column
    const { error: statusErr } = await supabase
      .from("pins")
      .select("status")
      .limit(1);

    if (statusErr && statusErr.message.includes("status")) {
      console.log("Adding status column to pins table...");
      try {
        const sqlResponse = await fetch(`${supabaseUrl}/sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ query: "ALTER TABLE pins ADD COLUMN IF NOT EXISTS status text DEFAULT 'new'" }),
        });
        if (sqlResponse.ok) {
          console.log("Added status column to pins table");
        }
      } catch {}
    }
    console.log("Pins table verified");
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());

  runMigrations().catch(err => console.error("Migration check failed:", err));

  app.get("/api/auth/google", async (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
    let host = req.get("x-forwarded-host") || req.get("host") || "";
    
    // In production (replit.app domains), don't add port - it routes internally
    // In development (.janeway.replit.dev), we need port 5000
    const isProduction = host.includes(".replit.app");
    if (!host.includes(":") && !isProduction) {
      host = `${host}:5000`;
    }
    const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
    
    const appRedirectUri = req.query.app_redirect_uri as string || "healthyhome://auth/callback";
    console.log("OAuth redirect_uri:", redirectUri);
    console.log("App redirect_uri:", appRedirectUri);
    console.log("Is production:", isProduction);

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId!);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "email profile");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("state", Buffer.from(appRedirectUri).toString("base64"));

    res.redirect(authUrl.toString());
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    console.log("OAuth callback hit with query:", req.query);
    const { code, state } = req.query;
    
    let appRedirectUri = "healthyhome://auth/callback";
    if (state) {
      try {
        appRedirectUri = Buffer.from(state as string, "base64").toString("utf-8");
        console.log("Decoded app redirect URI:", appRedirectUri);
      } catch (e) {
        console.error("Failed to decode state:", e);
      }
    }

    if (!code) {
      console.log("No code provided");
      return res.status(400).json({ error: "No code provided" });
    }

    try {
      const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
      let host = req.get("x-forwarded-host") || req.get("host") || "";
      
      // In production (replit.app domains), don't add port - it routes internally
      // In development (.janeway.replit.dev), we need port 5000
      const isProduction = host.includes(".replit.app");
      if (!host.includes(":") && !isProduction) {
        host = `${host}:5000`;
      }
      const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
      console.log("Callback redirectUri:", redirectUri);
      console.log("Callback isProduction:", isProduction);

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();
      console.log("Token response status:", tokenResponse.status);

      if (!tokenData.access_token) {
        console.error("Token exchange failed:", JSON.stringify(tokenData));
        return res.status(400).json({ error: "Failed to get access token", details: tokenData });
      }

      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      const userInfo = await userInfoResponse.json();
      console.log("User info from Google:", userInfo.email, userInfo.name);
      const role = getUserRole(userInfo.email);
      console.log("User role:", role);

      if (!role) {
        console.log("User not authorized - email not in ADMIN_EMAILS or REPS_EMAILS");
        const unauthorizedLink = `${appRedirectUri}${appRedirectUri.includes('?') ? '&' : '?'}error=unauthorized`;
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Access Denied</title>
            <style>
              body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #ff9500; color: white; text-align: center; }
              .container { padding: 20px; }
              a { color: white; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Access Denied</h2>
              <p>Your email is not authorized for this app.</p>
              <p><a href="${unauthorizedLink}">Tap here to return</a></p>
            </div>
            <script>
              setTimeout(function() { window.location.href = "${unauthorizedLink}"; }, 2000);
            </script>
          </body>
          </html>
        `);
      }

      const user: UserPayload = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        role,
      };

      const token = createToken(user);

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const redirectUrl = `${appRedirectUri}${appRedirectUri.includes('?') ? '&' : '?'}token=${token}`;
      console.log("Redirecting to:", redirectUrl);
      
      // For HTTPS URLs, do a direct redirect to our callback page
      if (appRedirectUri.startsWith('https://') || appRedirectUri.startsWith('http://')) {
        return res.redirect(redirectUrl);
      }
      
      // Fallback for exp:// deep links
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Signing in...</title>
          <style>
            body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0066CC; color: white; text-align: center; }
            .container { padding: 20px; }
            a { color: white; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Signing you in...</h2>
            <p>If the app doesn't open automatically, <a href="${redirectUrl}">tap here</a>.</p>
          </div>
          <script>
            window.location.href = "${redirectUrl}";
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Google auth error:", error);
      const errorLink = `${appRedirectUri}${appRedirectUri.includes('?') ? '&' : '?'}error=auth_failed`;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Error</title>
          <style>
            body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #cc0000; color: white; text-align: center; }
            .container { padding: 20px; }
            a { color: white; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Sign in failed</h2>
            <p><a href="${errorLink}">Tap here to return to the app</a>.</p>
          </div>
          <script>
            window.location.href = "${errorLink}";
          </script>
        </body>
        </html>
      `);
    }
  });

  // HTTPS callback for mobile auth
  app.get("/auth/callback", (req: Request, res: Response) => {
    const token = req.query.token as string;
    const error = req.query.error as string;
    const host = req.get("x-forwarded-host") || req.get("host") || "";
    const hostWithoutPort = host.split(":")[0];
    
    // Create Expo deep link for Expo Go
    const expoDeepLink = token 
      ? `exp://${hostWithoutPort}/--/auth/callback?token=${token}`
      : `exp://${hostWithoutPort}/--/auth/callback?error=${error || 'auth_failed'}`;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Authentication Complete</title>
        <style>
          body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0066CC; color: white; text-align: center; }
          .container { padding: 20px; }
          .btn { display: inline-block; padding: 15px 30px; background: white; color: #0066CC; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>${error ? 'Authentication Failed' : 'Authentication Complete'}</h2>
          <p>Tap the button below to return to the app.</p>
          <a href="${expoDeepLink}" class="btn">Open App</a>
        </div>
      </body>
      </html>
    `);
  });

  // Exchange Google access token for our JWT (used by expo-auth-session)
  app.post("/api/auth/google/token", async (req: Request, res: Response) => {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: "No access token provided" });
    }
    
    try {
      // Get user info from Google using the access token
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      if (!userInfoResponse.ok) {
        return res.status(400).json({ error: "Invalid access token" });
      }
      
      const userInfo = await userInfoResponse.json();
      console.log("Token exchange - User info:", userInfo.email, userInfo.name);
      
      const role = getUserRole(userInfo.email);
      console.log("Token exchange - User role:", role);
      
      if (!role) {
        return res.status(403).json({ error: "User not authorized" });
      }
      
      const user: UserPayload = {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        role,
      };
      
      const token = createToken(user);
      
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      
      res.json({ token, user });
    } catch (error) {
      console.error("Token exchange error:", error);
      res.status(500).json({ error: "Failed to exchange token" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const token =
      req.cookies?.auth_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.json({ user: null });
    }

    const user = verifyToken(token);
    res.json({ user });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie("auth_token");
    res.json({ success: true });
  });

  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const services = await getServices();
      res.json({ services });
    } catch (error) {
      console.error("Failed to get services:", error);
      res.json({
        services: [
          { id: "1", business_unit: "healthy_home", key: "house_wash", label: "House Wash", active: true },
          { id: "2", business_unit: "healthy_home", key: "cement_cleaning", label: "Cement Cleaning", active: true },
          { id: "3", business_unit: "healthy_home", key: "roof_wash", label: "Roof Wash", active: true },
          { id: "4", business_unit: "healthy_home", key: "gutter_cleaning", label: "Gutter Cleaning", active: true },
          { id: "5", business_unit: "healthy_home", key: "window_cleaning", label: "Window Cleaning", active: true },
          { id: "6", business_unit: "healthy_home", key: "deck_staining", label: "Deck Staining", active: true },
          { id: "7", business_unit: "healthy_home", key: "driveway_sealing", label: "Driveway Sealing", active: true },
          { id: "8", business_unit: "healthy_home", key: "holiday_lighting", label: "Holiday Lighting", active: true },
          { id: "9", business_unit: "healthy_home", key: "other", label: "Other", active: true },
        ],
      });
    }
  });

  app.get("/api/leads", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const leads = await getLeads(user.email, user.role === "admin");
      res.json({ leads });
    } catch (error) {
      console.error("Failed to get leads:", error);
      res.status(500).json({ error: "Failed to get leads" });
    }
  });

  app.get("/api/leads/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const lead = await getLead(req.params.id);
      res.json({ lead });
    } catch (error) {
      res.status(404).json({ error: "Lead not found" });
    }
  });

  app.put("/api/leads/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const leadId = req.params.id;

      const allowed = await canEditLead(leadId, user.email, user.role === "admin");
      if (!allowed) {
        return res.status(403).json({ error: "Not authorized to edit this lead" });
      }

      const ALLOWED_FIELDS = [
        "homeowner_name", "phone", "email", "status",
        "services_interested", "last_touch_at", "next_followup_at",
        "followup_channel", "followup_priority", "notes",
      ];
      const VALID_STATUSES = [
        "not_home", "not_interested", "follow_up", "sold", "completed",
        "no_answer", "contacted", "interested", "quoted", "booked", "do_not_knock",
      ];

      const sanitized: Record<string, unknown> = {};
      for (const field of ALLOWED_FIELDS) {
        if (req.body[field] !== undefined) {
          sanitized[field] = req.body[field];
        }
      }

      if (sanitized.status && !VALID_STATUSES.includes(sanitized.status as string)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      if (Object.keys(sanitized).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      sanitized.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("leads")
        .update(sanitized)
        .eq("id", leadId)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Lead not found" });

      await logActivity({
        activity_type: "d2d_lead_updated",
        lead_id: leadId,
        title: `Lead updated at ${data.address_line1 || 'unknown'}`,
        actor: user.email,
      });

      // Fire-and-forget: sync updated lead to Healthy Home backend
      (async () => {
        try {
          const backendId = await syncLeadToBackend(data, user.email);
          if (backendId && !data.backend_lead_id) {
            await supabase
              .from("leads")
              .update({ backend_lead_id: backendId })
              .eq("id", leadId);
          }
          // If lead moved to sold and backend has it, trigger conversion
          if (sanitized.status === "sold" && (data.backend_lead_id || backendId)) {
            await convertLeadInBackend(data.backend_lead_id || backendId!);
          }
        } catch {}
      })();

      res.json({ lead: data });
    } catch (error) {
      console.error("Failed to update lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.get("/api/leads/:id/touches", authMiddleware, async (req: Request, res: Response) => {
    try {
      const touches = await getTouches(req.params.id);
      res.json({ touches });
    } catch (error) {
      res.status(500).json({ error: "Failed to get touches" });
    }
  });

  app.get("/api/leads/:id/quotes", authMiddleware, async (req: Request, res: Response) => {
    try {
      const quotes = await getQuotes(req.params.id);
      res.json({ quotes });
    } catch (error) {
      res.status(500).json({ error: "Failed to get quotes" });
    }
  });

  app.get("/api/leads/:id/media", authMiddleware, async (req: Request, res: Response) => {
    try {
      const media = await getMedia(req.params.id);
      res.json({ media });
    } catch (error) {
      res.status(500).json({ error: "Failed to get media" });
    }
  });

  app.post("/api/leads/:id/media/upload", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const leadId = req.params.id;
      const { base64, filename, mime_type, type = "photo" } = req.body;

      if (!base64 || !filename) {
        return res.status(400).json({ error: "base64 and filename are required" });
      }

      const buffer = Buffer.from(base64, "base64");
      const ext = filename.split(".").pop() || "jpg";
      const storagePath = `leads/${leadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const bucket = "business-media";

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: mime_type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return res.status(500).json({ error: "Failed to upload file to storage" });
      }

      const record = await insertMedia({
        lead_id: leadId,
        rep_email: user.email,
        type,
        storage_bucket: bucket,
        storage_path: storagePath,
        mime_type: mime_type || "image/jpeg",
        original_filename: filename,
        size_bytes: buffer.length,
      });

      const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 3600);

      res.json({ media: { ...record, signed_url: signedData?.signedUrl || null } });
    } catch (error) {
      console.error("Failed to upload media:", error);
      res.status(500).json({ error: "Failed to upload media" });
    }
  });

  app.post("/api/leads/find", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { address_line1, zip, latitude, longitude } = req.body;
      const lead = await findLeadByAddressOrLatLng(
        address_line1,
        zip,
        latitude,
        longitude
      );
      res.json({ lead });
    } catch (error) {
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.post("/api/leads/upsert", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const result = await upsertLead(req.body, user.email);

      await logActivity({
        activity_type: result.isNew ? "d2d_lead_created" : "d2d_lead_updated",
        lead_id: result.lead.id,
        title: result.isNew
          ? `New lead created at ${result.lead.address_line1}`
          : `Lead updated at ${result.lead.address_line1}`,
        actor: user.email,
      });

      res.json(result);
    } catch (error) {
      console.error("Failed to upsert lead:", error);
      res.status(500).json({ error: "Failed to save lead" });
    }
  });

  app.post("/api/touches/create", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const { client_generated_id, lead, lead_id, touch, quote } = req.body;

      let finalLeadId = lead_id;

      if (lead && !lead_id) {
        const result = await upsertLead(lead, user.email);
        finalLeadId = result.lead.id;

        await logActivity({
          activity_type: result.isNew ? "d2d_lead_created" : "d2d_lead_updated",
          lead_id: finalLeadId,
          title: result.isNew
            ? `New lead created at ${lead.address_line1}`
            : `Lead updated at ${lead.address_line1}`,
          actor: user.email,
        });

        // Fire-and-forget: sync to Healthy Home backend
        (async () => {
          try {
            const { data: existing } = await supabase
              .from("leads")
              .select("backend_lead_id")
              .eq("id", finalLeadId)
              .single();
            const backendId = await syncLeadToBackend(
              { ...lead, id: finalLeadId, backend_lead_id: existing?.backend_lead_id },
              user.email,
              quote?.quote_amount
            );
            if (backendId && !existing?.backend_lead_id) {
              await supabase
                .from("leads")
                .update({ backend_lead_id: backendId })
                .eq("id", finalLeadId);
            }
          } catch {}
        })();
      }

      const touchData = await createTouch({
        ...touch,
        lead_id: finalLeadId,
        rep_email: user.email,
      });

      await logActivity({
        activity_type: "d2d_touch_created",
        lead_id: finalLeadId,
        title: `${touch.touch_type} - ${touch.outcome}`,
        details: { touch_id: touchData.id, notes: touch.notes },
        actor: user.email,
      });

      if (quote && quote.quote_line_items?.length > 0) {
        const quoteData = await createQuote({
          ...quote,
          lead_id: finalLeadId,
          rep_email: user.email,
        });

        await logActivity({
          activity_type: "d2d_quote_created",
          lead_id: finalLeadId,
          title: `Quote created: $${quote.quote_amount || 0}`,
          details: { quote_id: quoteData.id, line_items: quote.quote_line_items },
          actor: user.email,
        });
      }

      res.json({ success: true, touch: touchData, lead_id: finalLeadId });
    } catch (error) {
      console.error("Failed to create touch:", error);
      res.status(500).json({ error: "Failed to save touch" });
    }
  });

  app.post("/api/quotes/create", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const quote = await createQuote({
        ...req.body,
        rep_email: user.email,
      });

      await logActivity({
        activity_type: "d2d_quote_created",
        lead_id: req.body.lead_id,
        title: `Quote created: $${req.body.quote_amount || 0}`,
        actor: user.email,
      });

      res.json({ quote });
    } catch (error) {
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  app.post("/api/sync/batch", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const { items } = req.body;

      const results = [];

      for (const item of items) {
        try {
          if (item.type === "touch") {
            const { lead, lead_id, touch, quote } = item.payload;

            let finalLeadId = lead_id;
            if (lead && !lead_id) {
              const result = await upsertLead(lead, user.email);
              finalLeadId = result.lead.id;
            }

            await createTouch({
              ...touch,
              lead_id: finalLeadId,
              rep_email: user.email,
            });

            if (quote?.quote_line_items?.length > 0) {
              await createQuote({
                ...quote,
                lead_id: finalLeadId,
                rep_email: user.email,
              });
            }

            results.push({ id: item.id, success: true });
          }
        } catch (err) {
          results.push({ id: item.id, success: false, error: String(err) });
        }
      }

      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: "Batch sync failed" });
    }
  });

  app.post("/api/activity/log", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const activity = await logActivity({
        ...req.body,
        actor: user.email,
      });
      res.json({ activity });
    } catch (error) {
      res.status(500).json({ error: "Failed to log activity" });
    }
  });

  // Push today's (or any date's) canvassing stats to the Healthy Home backend as a session
  app.post("/api/sync/session", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const { date, neighborhood } = req.body;
      const targetDate = date || new Date().toISOString().split("T")[0];
      const start = `${targetDate}T00:00:00Z`;
      const end = `${targetDate}T23:59:59Z`;

      const [{ data: pins }, { data: leads }, { data: quotes }] = await Promise.all([
        supabase.from("pins").select("id").eq("created_by", user.email).gte("created_at", start).lte("created_at", end),
        supabase.from("leads").select("id, status").eq("created_by", user.email).gte("created_at", start).lte("created_at", end),
        supabase.from("d2d_quotes").select("quote_amount").eq("rep_email", user.email).gte("created_at", start).lte("created_at", end),
      ]);

      const doorsKnocked = pins?.length || 0;
      const peopleReached = leads?.length || 0;
      const soldLeads = (leads || []).filter((l: any) => l.status === "sold" || l.status === "completed");
      const quotedLeads = (leads || []).filter((l: any) =>
        ["quoted", "interested", "sold", "completed"].includes(l.status)
      );
      const totalRevenue = (quotes || []).reduce(
        (sum: number, q: any) => sum + parseFloat(q.quote_amount || "0"),
        0
      );

      const sessionId = await syncSessionToBackend({
        canvasser: user.email,
        date: targetDate,
        neighborhood: neighborhood || undefined,
        doorsKnocked,
        peopleReached,
        quotesGiven: quotedLeads.length,
        closes: soldLeads.length,
        revenueSold: totalRevenue.toFixed(2),
      });

      res.json({
        success: true,
        sessionId,
        stats: { doorsKnocked, peopleReached, quotesGiven: quotedLeads.length, closes: soldLeads.length, revenueSold: totalRevenue.toFixed(2) },
      });
    } catch (error) {
      console.error("Failed to sync session:", error);
      res.status(500).json({ error: "Failed to sync session to backend" });
    }
  });

  // Fetch live dashboard data from the Healthy Home backend
  app.get("/api/backend/dashboard", authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
    try {
      const dashboard = await fetchBackendDashboard();
      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch backend dashboard" });
    }
  });

  app.get("/api/pins", authMiddleware, async (req: Request, res: Response) => {
    try {
      const pins = await getPinsWithLeads();
      res.json({ pins });
    } catch (error) {
      console.error("Failed to get pins:", error);
      res.status(500).json({ error: "Failed to get pins" });
    }
  });

  app.get("/api/pins/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const pin = await getPin(req.params.id);
      const canEdit = await canEditPin(req.params.id, user.email);
      res.json({ pin, canEdit });
    } catch (error) {
      res.status(404).json({ error: "Pin not found" });
    }
  });

  app.post("/api/pins/create", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const pin = await createPin({
        ...req.body,
        created_by: user.email,
      });

      await logActivity({
        activity_type: "pin_created",
        title: `Pin created at ${pin.address_line1 || 'unknown location'}`,
        details: { pin_id: pin.id, latitude: pin.latitude, longitude: pin.longitude },
        actor: user.email,
      });

      res.json({ pin });
    } catch (error) {
      console.error("Failed to create pin:", error);
      res.status(500).json({ error: "Failed to create pin" });
    }
  });

  app.put("/api/pins/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const pin = await updatePin(req.params.id, req.body, user.email);
      res.json({ pin });
    } catch (error: any) {
      if (error.message?.includes("Not authorized")) {
        return res.status(403).json({ error: "Not authorized to edit this pin" });
      }
      res.status(500).json({ error: "Failed to update pin" });
    }
  });

  app.post("/api/pins/create-with-lead", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const { pin: pinData, lead: leadData, touch, quote } = req.body;

      const leadStatus = touch?.outcome || "new";
      const result = await createLeadWithPin(
        {
          pin: { ...pinData, created_by: user.email },
          lead: leadData ? { ...leadData, status: leadStatus } : null,
        },
        user.email
      );

      await logActivity({
        activity_type: result.lead ? "pin_and_lead_created" : "pin_created",
        lead_id: result.lead?.id || null,
        title: result.lead
          ? `Pin and lead created at ${result.pin.address_line1 || 'unknown location'}`
          : `Pin created at ${result.pin.address_line1 || 'unknown location'}`,
        details: { pin_id: result.pin.id },
        actor: user.email,
      });

      if (result.lead && touch) {
        const touchData = await createTouch({
          ...touch,
          lead_id: result.lead.id,
          rep_email: user.email,
        });

        await logActivity({
          activity_type: "d2d_touch_created",
          lead_id: result.lead.id,
          title: `${touch.touch_type} - ${touch.outcome}`,
          details: { touch_id: touchData.id, notes: touch.notes },
          actor: user.email,
        });

        if (quote && quote.quote_line_items?.length > 0) {
          await createQuote({
            ...quote,
            lead_id: result.lead.id,
            rep_email: user.email,
          });
        }
      }

      // Fire-and-forget: sync new lead to Healthy Home backend
      if (result.lead) {
        (async () => {
          try {
            const backendId = await syncLeadToBackend(
              result.lead!,
              user.email,
              quote?.quote_amount
            );
            if (backendId) {
              console.log(`[backendSync] Lead synced to backend id=${backendId} status=${leadStatus}`);
              await supabase
                .from("leads")
                .update({ backend_lead_id: backendId })
                .eq("id", result.lead!.id);
              // If sold, trigger conversion in backend
              if (leadStatus === "sold") {
                await convertLeadInBackend(backendId);
                console.log(`[backendSync] Sold lead converted in backend id=${backendId}`);
              }
            } else {
              console.warn(`[backendSync] create-with-lead sync returned no backendId`);
            }
          } catch (e: any) {
            console.warn(`[backendSync] create-with-lead sync error:`, e?.message);
          }
        })();
      }

      res.json(result);
    } catch (error) {
      console.error("Failed to create pin with lead:", error);
      res.status(500).json({ error: "Failed to create pin with lead" });
    }
  });

  app.get("/api/leads/:id/can-edit", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const canEdit = await canEditLead(req.params.id, user.email, user.role === "admin");
      res.json({ canEdit });
    } catch (error) {
      res.status(500).json({ error: "Failed to check permissions" });
    }
  });

  app.get("/api/geocode/reverse", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ error: "lat and lng are required" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Geocoding not configured" });
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const components = result.address_components || [];
        const getComponent = (type: string) =>
          components.find((c: { types: string[] }) => c.types.includes(type))?.long_name || "";

        res.json({
          address_line1: `${getComponent("street_number")} ${getComponent("route")}`.trim() || "Unknown Address",
          city: getComponent("locality") || getComponent("sublocality"),
          state: getComponent("administrative_area_level_1"),
          zip: getComponent("postal_code"),
          latitude: parseFloat(lat as string),
          longitude: parseFloat(lng as string),
          formatted_address: result.formatted_address,
        });
      } else {
        res.status(404).json({ error: "No address found" });
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
      res.status(500).json({ error: "Geocoding failed" });
    }
  });

  // ========================
  // Routes & Route Stops
  // ========================

  app.get("/api/routes", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      let query = supabase.from("routes").select("*, route_stops(*, lead:leads(*))").order("date", { ascending: true });

      if (user.role !== "admin") {
        query = query.eq("rep_email", user.email);
      }

      if (req.query.date) {
        query = query.eq("date", req.query.date);
      }

      const { data, error } = await query;
      if (error) throw error;

      const routes = (data || []).map((r: any) => ({
        ...r,
        stops: (r.route_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order),
      }));
      delete (routes as any).route_stops;

      res.json({ routes });
    } catch (error: any) {
      // Table may not exist yet — return empty gracefully
      console.warn("Failed to get routes (table may not exist):", error?.message);
      res.json({ routes: [] });
    }
  });

  app.post("/api/routes", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const { name, date, rep_email, rep_name, status } = req.body;

      const { data, error } = await supabase
        .from("routes")
        .insert({
          admin_id: user.email,
          name: name || null,
          date,
          rep_email: rep_email || null,
          rep_name: rep_name || null,
          status: status || "draft",
        })
        .select()
        .single();

      if (error) throw error;

      await logActivity({
        activity_type: "route_created",
        title: `Route created for ${date}`,
        details: { route_id: data.id, rep_email },
        actor: user.email,
      });

      res.json({ route: data });
    } catch (error) {
      console.error("Failed to create route:", error);
      res.status(500).json({ error: "Failed to create route" });
    }
  });

  app.put("/api/routes/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const { name, date, rep_email, rep_name, status } = req.body;

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (date !== undefined) updates.date = date;
      if (rep_email !== undefined) updates.rep_email = rep_email;
      if (rep_name !== undefined) updates.rep_name = rep_name;
      if (status !== undefined) updates.status = status;

      const { data, error } = await supabase
        .from("routes")
        .update(updates)
        .eq("id", req.params.id)
        .select()
        .single();

      if (error) throw error;

      await logActivity({
        activity_type: "route_updated",
        title: `Route updated: ${data.name || data.date}`,
        details: { route_id: data.id },
        actor: user.email,
      });

      res.json({ route: data });
    } catch (error) {
      console.error("Failed to update route:", error);
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  app.delete("/api/routes/:id", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { error } = await supabase.from("routes").delete().eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete route" });
    }
  });

  app.post("/api/routes/:id/stops", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { lead_id, stop_order, arrival_window, notes } = req.body;

      const { data, error } = await supabase
        .from("route_stops")
        .insert({
          route_id: req.params.id,
          lead_id,
          stop_order: stop_order || 0,
          arrival_window: arrival_window || null,
          notes: notes || null,
        })
        .select("*, lead:leads(*)")
        .single();

      if (error) throw error;
      res.json({ stop: data });
    } catch (error) {
      console.error("Failed to add stop:", error);
      res.status(500).json({ error: "Failed to add stop" });
    }
  });

  app.put("/api/routes/:id/stops/:stopId", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { stop_order, arrival_window, notes, status } = req.body;

      const updates: Record<string, unknown> = {};
      if (stop_order !== undefined) updates.stop_order = stop_order;
      if (arrival_window !== undefined) updates.arrival_window = arrival_window;
      if (notes !== undefined) updates.notes = notes;
      if (status !== undefined) updates.status = status;

      const { data, error } = await supabase
        .from("route_stops")
        .update(updates)
        .eq("id", req.params.stopId)
        .select("*, lead:leads(*)")
        .single();

      if (error) throw error;
      res.json({ stop: data });
    } catch (error) {
      res.status(500).json({ error: "Failed to update stop" });
    }
  });

  app.delete("/api/routes/:id/stops/:stopId", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { error } = await supabase.from("route_stops").delete().eq("id", req.params.stopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stop" });
    }
  });

  app.get("/api/routes/:id/sms", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { data: route, error } = await supabase
        .from("routes")
        .select("*, route_stops(*, lead:leads(*))")
        .eq("id", req.params.id)
        .single();

      if (error) throw error;

      const stops = (route.route_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
      let sms = `Healthy Home — Route for ${route.date}\nAssigned to: ${route.rep_name || route.rep_email || "Unassigned"}\n\n`;

      stops.forEach((stop: any, i: number) => {
        const lead = stop.lead;
        sms += `Stop ${i + 1} — ${lead?.address_line1 || "Unknown"}\n`;
        if (stop.arrival_window) sms += `Arrival: ${stop.arrival_window}\n`;
        if (lead?.services_interested?.length) sms += `Services: ${lead.services_interested.join(", ")}\n`;
        if (lead?.homeowner_name || lead?.contact_name) sms += `Customer: ${lead.homeowner_name || lead.contact_name}`;
        if (lead?.phone || lead?.contact_phone) sms += ` (${lead.phone || lead.contact_phone})`;
        sms += "\n";
        if (stop.notes) sms += `Notes: ${stop.notes}\n`;
        sms += "\n";
      });

      sms += `Total stops: ${stops.length}\nQuestions? Call the office.`;

      res.json({ sms });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate SMS" });
    }
  });

  // ========================
  // Rep Locations
  // ========================

  app.post("/api/rep-locations", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as UserPayload;
      const { lat, lng } = req.body;

      const { data, error } = await supabase
        .from("rep_locations")
        .insert({
          rep_email: user.email,
          rep_name: user.name,
          lat,
          lng,
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ location: data });
    } catch (error) {
      res.status(500).json({ error: "Failed to save location" });
    }
  });

  app.get("/api/rep-locations/live", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("rep_locations")
        .select("*")
        .gte("recorded_at", fiveMinAgo)
        .order("recorded_at", { ascending: false });

      if (error) {
        // Table may not exist yet (migration not run) — return empty gracefully
        console.warn("rep_locations query error (table may not exist):", error.message);
        return res.json({ locations: [] });
      }

      const latestByRep = new Map<string, any>();
      (data || []).forEach((loc: any) => {
        if (!latestByRep.has(loc.rep_email)) {
          latestByRep.set(loc.rep_email, loc);
        }
      });

      res.json({ locations: Array.from(latestByRep.values()) });
    } catch (error) {
      res.json({ locations: [] });
    }
  });

  // ========================
  // Analytics
  // ========================

  app.get("/api/analytics/summary", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { start_date, end_date } = req.query;
      let query = supabase.from("leads").select("id, status, created_at, sold_at");

      if (start_date) query = query.gte("created_at", start_date);
      if (end_date) query = query.lte("created_at", end_date);

      const { data: leads, error } = await query;
      if (error) throw error;

      const allLeads = leads || [];
      const total_leads = allLeads.length;
      const total_sold = allLeads.filter((l: any) => l.status === "sold").length;
      const total_completed = allLeads.filter((l: any) => l.status === "completed").length;

      const { count: pinsCount } = await supabase
        .from("pins")
        .select("id", { count: "exact", head: true });

      res.json({
        summary: {
          total_doors: pinsCount || 0,
          total_leads,
          total_sold,
          total_completed,
          conversion_rate: total_leads > 0 ? Math.round((total_sold / total_leads) * 100) : 0,
        },
      });
    } catch (error) {
      console.warn("Failed to get analytics:", error);
      res.json({ summary: { total_doors: 0, total_leads: 0, total_sold: 0, total_completed: 0, conversion_rate: 0 } });
    }
  });

  app.get("/api/analytics/reps", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { data: leads, error } = await supabase.from("leads").select("id, status, created_by");
      if (error) throw error;

      const { data: pins } = await supabase.from("pins").select("id, created_by");

      const repMap = new Map<string, { doors: number; leads: number; sold: number }>();

      (pins || []).forEach((p: any) => {
        if (!repMap.has(p.created_by)) repMap.set(p.created_by, { doors: 0, leads: 0, sold: 0 });
        repMap.get(p.created_by)!.doors++;
      });

      (leads || []).forEach((l: any) => {
        const email = l.created_by || "unknown";
        if (!repMap.has(email)) repMap.set(email, { doors: 0, leads: 0, sold: 0 });
        repMap.get(email)!.leads++;
        if (l.status === "sold") repMap.get(email)!.sold++;
      });

      const reps = Array.from(repMap.entries()).map(([email, stats]) => ({
        rep_email: email,
        rep_name: email.split("@")[0],
        ...stats,
        conversion_rate: stats.leads > 0 ? Math.round((stats.sold / stats.leads) * 100) : 0,
      }));

      res.json({ reps });
    } catch (error) {
      res.status(500).json({ error: "Failed to get rep analytics" });
    }
  });

  // ========================
  // User Management
  // ========================

  app.get("/api/users", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);
      const repEmails = (process.env.REPS_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

      const allEmails = [...new Set([...adminEmails, ...repEmails])];

      const { data: pins } = await supabase.from("pins").select("created_by");
      const { data: leads } = await supabase.from("leads").select("created_by, status");

      const users = allEmails.map(email => {
        const role = adminEmails.includes(email) ? "admin" : "rep";
        const userPins = (pins || []).filter((p: any) => p.created_by === email);
        const userLeads = (leads || []).filter((l: any) => l.created_by === email);
        const sold = userLeads.filter((l: any) => l.status === "sold").length;

        return {
          email,
          name: email.split("@")[0],
          role,
          leads_total: userLeads.length,
          sales_total: sold,
          doors_total: userPins.length,
        };
      });

      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // Get sold leads not yet assigned to any route
  app.get("/api/leads/unscheduled", authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
      const { data: scheduledLeadIds } = await supabase
        .from("route_stops")
        .select("lead_id");

      const excludeIds = (scheduledLeadIds || []).map((s: any) => s.lead_id).filter(Boolean);

      let query = supabase.from("leads").select("*").eq("status", "sold");

      if (excludeIds.length > 0) {
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }

      const { data, error } = await query.order("sold_at", { ascending: false });
      if (error) throw error;

      res.json({ leads: data || [] });
    } catch (error) {
      res.status(500).json({ error: "Failed to get unscheduled leads" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
