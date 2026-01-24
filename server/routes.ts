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
} from "./lib/crmAdapter";
import { supabase } from "./lib/supabase";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());

  app.get("/api/auth/google", async (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
    let host = req.get("x-forwarded-host") || req.get("host") || "";
    
    if (!host.includes(":")) {
      host = `${host}:5000`;
    }
    const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
    
    const appRedirectUri = req.query.app_redirect_uri as string || "wolfpackd2d://auth/callback";
    console.log("OAuth redirect_uri:", redirectUri);
    console.log("App redirect_uri:", appRedirectUri);

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
      
      if (!host.includes(":")) {
        host = `${host}:5000`;
      }
      const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
      console.log("Callback redirectUri:", redirectUri);

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

      const deepLink = `${appRedirectUri}${appRedirectUri.includes('?') ? '&' : '?'}token=${token}`;
      console.log("Redirecting to deep link:", deepLink);
      
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
            <p>If the app doesn't open automatically, <a href="${deepLink}">tap here</a>.</p>
          </div>
          <script>
            window.location.href = "${deepLink}";
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

  const httpServer = createServer(app);
  return httpServer;
}
