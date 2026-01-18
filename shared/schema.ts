import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const leadSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  source: z.string().default("d2d"),
  business_unit: z.string().default("wolfpack_wash"),
  homeowner_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address_line1: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  services_interested: z.array(z.string()).nullable(),
  tags: z.array(z.string()).nullable(),
  status: z.enum([
    "new",
    "contacted",
    "interested",
    "quoted",
    "booked",
    "not_interested",
    "do_not_knock",
  ]).default("new"),
  assigned_rep_email: z.string().nullable(),
  last_touch_at: z.string().nullable(),
  next_followup_at: z.string().nullable(),
  followup_channel: z.enum(["call", "text", "knock"]).nullable(),
  followup_priority: z.enum(["low", "med", "high"]).nullable(),
  do_not_knock: z.boolean().default(false),
});

export type Lead = z.infer<typeof leadSchema>;

export const touchSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  lead_id: z.string().uuid(),
  rep_email: z.string(),
  touch_type: z.enum(["knock", "call", "text", "note"]),
  outcome: z.enum([
    "no_answer",
    "contacted",
    "interested",
    "quoted",
    "booked",
    "not_interested",
    "do_not_knock",
  ]),
  notes: z.string().nullable(),
  next_followup_at: z.string().nullable(),
  followup_channel: z.enum(["call", "text", "knock"]).nullable(),
  followup_priority: z.enum(["low", "med", "high"]).nullable(),
});

export type Touch = z.infer<typeof touchSchema>;

export const quoteLineItemSchema = z.object({
  service: z.string(),
  price: z.number(),
  sqft: z.number().nullable(),
  notes: z.string(),
});

export type QuoteLineItem = z.infer<typeof quoteLineItemSchema>;

export const quoteSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  lead_id: z.string().uuid(),
  rep_email: z.string(),
  offer_version: z.string().nullable(),
  quote_amount: z.number().nullable(),
  quote_line_items: z.array(quoteLineItemSchema),
  estimated_duration_minutes: z.number().nullable(),
  proposed_timeframe: z.string().nullable(),
  notes: z.string().nullable(),
});

export type Quote = z.infer<typeof quoteSchema>;

export const mediaSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  lead_id: z.string().uuid(),
  touch_id: z.string().uuid().nullable(),
  rep_email: z.string(),
  type: z.enum(["image", "video"]),
  storage_bucket: z.string(),
  storage_path: z.string(),
  mime_type: z.string().nullable(),
  original_filename: z.string().nullable(),
  size_bytes: z.number().nullable(),
  captured_at: z.string(),
});

export type Media = z.infer<typeof mediaSchema>;

export const serviceSchema = z.object({
  id: z.string().uuid(),
  business_unit: z.string().default("wolfpack_wash"),
  key: z.string(),
  label: z.string(),
  active: z.boolean().default(true),
});

export type Service = z.infer<typeof serviceSchema>;

export const activitySchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  business_unit: z.string().default("wolfpack_wash"),
  activity_type: z.string(),
  lead_id: z.string().uuid().nullable(),
  title: z.string(),
  details: z.record(z.unknown()).nullable(),
  actor: z.string().nullable(),
});

export type Activity = z.infer<typeof activitySchema>;
