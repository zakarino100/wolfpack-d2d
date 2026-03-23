# Healthy Home - Door-to-Door Canvassing App

## Overview
A mobile-first D2D canvassing app (formerly Wolfpack D2D) for Healthy Home field sales. Integrates with Supabase CRM. Features role-based navigation: reps canvass, log visits, track follow-ups, and follow routes; admins manage routes, view live rep locations, analyze performance, and oversee leads.

## Tech Stack
- **Frontend**: React Native + Expo
- **Backend**: Express.js + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Google OAuth
- **Maps**: Google Maps + Geocoding API

## Brand / Design
- **Primary**: #4A9B8E (teal)
- **Dark**: #1B3A4B
- **Light**: #C8DDD5
- **Background**: #F7FAF9
- **Door Outcomes** (no lead created): knocked_no_answer (gray), not_home (gray), inaccessible (dark gray), do_not_knock (dark red)
- **Lead Statuses** (creates/updates lead): not_interested (red), revisit_needed (orange), follow_up (yellow), callback_set (yellow), quote_given (blue), estimate_scheduled (purple), sold/won (green), lost (red), completed (teal)
- **Backend Sync Mapping**: door outcomes → "new", not_interested/lost → "lost", follow_up/callback_set → "follow_up", quote_given/estimate_scheduled → "quoted", sold/won/completed → "sold"

## Architecture

### Frontend (client/)
- `App.tsx` - Root component with AuthProvider, ErrorBoundary
- `navigation/RootStackNavigator.tsx` - Role-based routing (admin → AdminTabNavigator, rep → MainTabNavigator)
- `navigation/MainTabNavigator.tsx` - Rep tabs: Canvass, Leads, Route, Follow-ups, Profile
- `navigation/AdminTabNavigator.tsx` - Admin tabs: Live Map, Canvass, Routes, Leads, Analytics, Team
- `screens/` - Main app screens
  - `CanvassScreen.tsx` - Map-based canvassing with pin dropping
  - `LeadsScreen.tsx` - Rep's leads list
  - `RouteScreen.tsx` - Rep's assigned route for today
  - `FollowupsScreen.tsx` - Calendar view of follow-ups
  - `ProfileScreen.tsx` - Stats, location sharing toggle, sync
  - `LeadDetailScreen.tsx` - Full lead details with inline touch modal + edit mode
  - `LoginScreen.tsx` - Google OAuth login
  - `admin/AdminMapScreen.tsx` - Live map of all pins + rep locations
  - `admin/RouteBuilderScreen.tsx` - Two-tab screen: Routes (create/manage routes with stops) and Jobs (schedule HH backend jobs to technicians with hour-by-hour time slots, 4-job-per-tech-per-day cap)
  - `admin/AllLeadsScreen.tsx` - All leads across reps with search/filter
  - `admin/AnalyticsScreen.tsx` - Summary cards + per-rep breakdown
  - `admin/TeamScreen.tsx` - Team member list with stats
- `components/` - Reusable UI components (Card, Button, StatusBadge, LeadCard, etc.)
- `hooks/` - Custom hooks (useAuth, useTheme, useScreenOptions)
- `lib/` - API client (query-client.ts), storage utilities
- `types/` - TypeScript interfaces
- `constants/theme.ts` - Brand colors, statuses, services, spacing

### Backend (server/)
- `index.ts` - Express server setup on port 5000
- `routes.ts` - All API endpoints
- `lib/auth.ts` - JWT authentication + role management (admin/rep via env vars)
- `lib/supabase.ts` - Supabase client
- `lib/crmAdapter.ts` - Database operations layer
- `migrations/d2d_tables.sql` - Original tables
- `migrations/healthy_home_tables.sql` - New tables (routes, route_stops, rep_locations) + lead scheduling columns

## Database Tables
- `leads` - Customer/prospect records (with scheduling: preferred_day, preferred_time, scheduling_notes, sold_at, contact_name, contact_phone)
- `pins` - Map pins with status, location, optional linked lead
- `d2d_touches` - Visit/contact history
- `d2d_quotes` - Quote snapshots
- `d2d_media` - Photo/video uploads
- `d2d_services` - Configurable services list
- `crm_activity` - CRM activity feed integration
- `routes` - Admin-created route assignments (name, date, assigned_rep, status)
- `route_stops` - Ordered stops within a route (lead_id, stop_order, arrival_window, notes, status)
- `rep_locations` - GPS pings from reps (lat, lng, timestamp)

## API Endpoints

### Auth
- `GET /api/auth/google` - Google OAuth flow
- `GET /api/auth/me` - Get current user

### Leads
- `GET /api/leads` - List leads (filtered by role)
- `GET /api/leads/:id` - Get lead details
- `GET /api/leads/:id/touches` - Get touch history
- `GET /api/leads/:id/quotes` - Get quotes
- `GET /api/leads/:id/can-edit` - Check if user can edit lead
- `PUT /api/leads/:id` - Update lead (auth-guarded, field-whitelisted)
- `GET /api/leads/unscheduled` - Get sold leads without routes

### Touches & Sync
- `POST /api/touches/create` - Create touch + lead + quote
- `POST /api/sync/batch` - Sync offline queue

### Pins
- `GET /api/pins` - List all pins with linked leads
- `GET /api/pins/:id` - Get pin details with canEdit flag
- `POST /api/pins/create` - Create a new pin
- `PUT /api/pins/:id` - Update a pin (creator only)
- `POST /api/pins/create-with-lead` - Create pin with optional lead

### Routes (Admin)
- `GET /api/routes` - List routes (admin: all, rep: assigned)
- `POST /api/routes` - Create route (admin only)
- `PUT /api/routes/:id` - Update route (admin only)
- `POST /api/routes/:id/stops` - Add stop to route
- `PUT /api/routes/:id/stops/:stopId` - Update stop
- `DELETE /api/routes/:id/stops/:stopId` - Remove stop
- `GET /api/routes/:id/sms` - Get SMS-formatted route text

### Backend Jobs Proxy (HH Backend → Canvassing App)
- `GET /api/backend/jobs` - List all HH backend jobs (query param: ?status=scheduled|completed|canceled|rescheduled)
- `PUT /api/backend/jobs/:id` - Update HH backend job (schedule date, technician, notes, status)
- `GET /api/backend/technicians` - List technicians from HH backend (role=technician users)

### Rep Locations
- `POST /api/rep-locations` - Rep sends GPS coordinates
- `GET /api/rep-locations/live` - Admin gets active rep positions (last 5 min)

### Analytics
- `GET /api/analytics/summary` - Total doors, leads, sold, conversion rate
- `GET /api/analytics/reps` - Per-rep breakdown

### Users
- `GET /api/users` - List all users (admin only)

## User Roles
- **Admin**: Full access, sees AdminTabNavigator (5 tabs), manages routes/team (ADMIN_EMAILS env var)
- **Rep**: Own leads only, sees MainTabNavigator (5 tabs), follows routes (REPS_EMAILS env var)

## Services
House Wash, Cement Cleaning, Roof Wash, Gutter Cleaning, Window Cleaning, Deck Staining, Driveway Sealing, Holiday Lighting, Other

## Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `GOOGLE_MAPS_API_KEY` - Maps API key
- `ADMIN_EMAILS` - Comma-separated admin emails
- `REPS_EMAILS` - Comma-separated rep emails
- `NEXTAUTH_SECRET` - JWT signing secret

## Healthy Home Backend Integration

The canvassing app auto-syncs with the Healthy Home backend CRM at `https://healthy-home-backend.replit.app`.

### Auto-sync (fires silently on every action)
- **New lead created** (via touch) → POST `/api/canvassing/leads` on backend
- **Lead updated** → PUT `/api/canvassing/leads/:id` on backend
- **Lead marked "sold"** → POST `/api/canvassing/leads/:id/convert` (creates a customer)
- Backend lead IDs are stored in `leads.backend_lead_id` for future updates

### Manual sync (rep-triggered)
- Profile screen → "Backend Report" → "Push Session" button
- Calls `POST /api/sync/session` on this server
- Computes today's doors/leads/closes/revenue from Supabase for that rep
- Pushes as a canvassing session to backend `POST /api/canvassing/sessions`

### Admin endpoint
- `GET /api/backend/dashboard` — fetches today's KPIs + weekly leaderboard from backend

### Status mapping (canvassing → backend)
| Canvassing app | Backend status |
|---|---|
| not_home, no_answer | new |
| not_interested, do_not_knock | lost |
| follow_up, booked | follow_up |
| contacted, interested, quoted | quoted |
| sold, completed | sold |

### Sync adapter
`server/lib/backendSync.ts` — all backend communication lives here. No auth required (open endpoints). If you add a `X-API-Key` header to the backend later, update `backendSync.ts`.

## Setup Instructions

1. Run SQL migrations in Supabase SQL Editor:
   - `server/migrations/d2d_tables.sql` (original tables)
   - `server/migrations/healthy_home_tables.sql` (new tables: routes, route_stops, rep_locations + scheduling columns)

2. Configure environment variables (via Secrets)

3. Create Supabase storage bucket: `business-media` (private)

4. Start the app:
   - Backend runs on port 5000
   - Expo dev server runs on port 8081

## Key Features
- **Rep Canvassing**: Drop pins on map, log leads with status/services/notes
- **Follow-up Calendar**: Monthly calendar view with dot indicators, tap to see/manage follow-ups
- **Route Following**: View assigned route, get directions, toggle stop completion; "Jobs" tab shows HH backend jobs with schedule/edit modals
- **Location Sharing**: Opt-in GPS sharing every 60s when enabled
- **Admin Live Map**: All pins + live rep positions with status filtering
- **Route Builder**: Create routes, add sold leads as stops, assign to reps, share via SMS
- **Analytics**: Summary cards + per-rep performance breakdown
- **Offline Support**: Touches queued locally, auto-sync on reconnection
