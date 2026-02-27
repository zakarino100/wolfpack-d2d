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
        business_unit text DEFAULT 'wolfpack_wash',
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
    
    const appRedirectUri = req.query.app_redirect_uri as string || "wolfpackd2d://auth/callback";
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
    
    let appRedirectUri = "wolfpackd2d://auth/callback";
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
          { id: "1", business_unit: "wolfpack_wash", key: "house_wash", label: "House Wash", active: true },
          { id: "2", business_unit: "wolfpack_wash", key: "driveway", label: "Driveway/Walkway", active: true },
          { id: "3", business_unit: "wolfpack_wash", key: "roof_wash", label: "Roof Wash", active: true },
          { id: "4", business_unit: "wolfpack_wash", key: "gutters", label: "Gutters", active: true },
          { id: "5", business_unit: "wolfpack_wash", key: "windows", label: "Windows", active: true },
          { id: "6", business_unit: "wolfpack_wash", key: "deck_fence", label: "Deck/Fence", active: true },
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

  const httpServer = createServer(app);
  return httpServer;
}
