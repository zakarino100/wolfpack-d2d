# Wolfpack D2D - Door-to-Door Canvassing App

## Overview
A mobile-first D2D canvassing app for Wolfpack Wash that integrates with the existing Supabase CRM. Field sales reps can log visits, capture quotes, track follow-ups, and sync data with the CRM activity feed.

## Tech Stack
- **Frontend**: React Native + Expo
- **Backend**: Express.js + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Google OAuth
- **Maps**: Google Maps + Geocoding API

## Architecture

### Frontend (client/)
- `App.tsx` - Root component with AuthProvider
- `navigation/` - React Navigation setup (tabs + stack)
- `screens/` - Main app screens (Canvass, Leads, Follow-ups, Profile, LeadDetail)
- `components/` - Reusable UI components
- `hooks/` - Custom hooks (useAuth, useTheme)
- `lib/` - API client, storage utilities
- `types/` - TypeScript interfaces

### Backend (server/)
- `index.ts` - Express server setup
- `routes.ts` - API endpoints
- `lib/auth.ts` - JWT authentication + role management
- `lib/supabase.ts` - Supabase client
- `lib/crmAdapter.ts` - Database operations layer

## Database Tables
- `leads` - Customer/prospect records
- `pins` - Map pins with status, location, optional linked lead (has `status` column)
- `d2d_touches` - Visit/contact history
- `d2d_quotes` - Quote snapshots
- `d2d_media` - Photo/video uploads
- `d2d_services` - Configurable services list
- `crm_activity` - CRM activity feed integration

## API Endpoints
- `GET /api/auth/google` - Google OAuth flow
- `GET /api/auth/me` - Get current user
- `GET /api/leads` - List leads (filtered by role)
- `GET /api/leads/:id` - Get lead details
- `GET /api/leads/:id/touches` - Get touch history
- `GET /api/leads/:id/quotes` - Get quotes
- `GET /api/leads/:id/can-edit` - Check if user can edit lead
- `PUT /api/leads/:id` - Update lead (authorized, field-whitelisted)
- `POST /api/touches/create` - Create touch + lead + quote
- `POST /api/sync/batch` - Sync offline queue
- `GET /api/pins` - List all pins with linked leads
- `GET /api/pins/:id` - Get pin details with canEdit flag
- `POST /api/pins/create` - Create a new pin
- `PUT /api/pins/:id` - Update a pin (creator only)
- `POST /api/pins/create-with-lead` - Create pin with optional lead

## User Roles
- **Admin**: Full access to all leads/data (ADMIN_EMAILS env var)
- **Rep**: Access to assigned leads only (REPS_EMAILS env var)

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

## Setup Instructions

1. Run the SQL migration in your Supabase SQL Editor:
   - Copy contents of `server/migrations/d2d_tables.sql`
   - Execute in Supabase Dashboard > SQL Editor

2. Configure environment variables (already done via Secrets)

3. Create Supabase storage bucket:
   - Name: `business-media`
   - Public: No

4. Start the app:
   - Backend runs on port 5000
   - Expo dev server runs on port 8081

## Offline Support
- Touches are queued locally when offline
- Auto-sync on reconnection
- Idempotent sync using client_generated_id

## Design System
- Primary color: #0066CC
- Status colors for lead states
- iOS-native feel with blur effects
- High contrast for outdoor readability
