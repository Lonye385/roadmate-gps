import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real, json, pgEnum, unique, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for camera verification status
export const verificationStatusEnum = pgEnum("verification_status", ["confirmed", "not_found"]);

// Session storage table (REQUIRED by Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (Replit Auth + Gamification)
export const users = pgTable("users", {
  // Replit Auth fields
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Gamification fields
  username: text("username").unique(), // Optional username for display
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  totalKm: real("total_km").notNull().default(0),
  totalTrips: integer("total_trips").notNull().default(0),
  countriesVisited: text("countries_visited").array().notNull().default(sql`ARRAY[]::text[]`),
  vehicleProfile: text("vehicle_profile").notNull().default("car"),
  countryFlag: text("country_flag"),
  tagline: text("tagline"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  startLocation: text("start_location").notNull(),
  endLocation: text("end_location"),
  distance: real("distance").notNull().default(0),
  duration: integer("duration").notNull().default(0),
  xpEarned: integer("xp_earned").notNull().default(0),
  countriesCrossed: text("countries_crossed").array().notNull().default(sql`ARRAY[]::text[]`),
  vehicleProfile: text("vehicle_profile").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  iconType: text("icon_type").notNull(),
  category: text("category").notNull(),
  requirement: json("requirement").notNull(),
  xpReward: integer("xp_reward").notNull().default(0),
});

export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  badgeId: varchar("badge_id").notNull().references(() => badges.id),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'accident', 'traffic_jam', 'hazard', 'police', 'drone', 'helicopter', 'roadwork', 'weather', 'other'
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  location: text("location").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"), // 'low', 'medium', 'high'
  verified: boolean("verified").notNull().default(false),
  upvotes: integer("upvotes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Auto-expire after X hours
});

export const speedCameras = pgTable("speed_cameras", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'fixed', 'mobile', 'redlight', 'section', 'tunnel', 'variable'
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  location: text("location").notNull(),
  speedLimit: integer("speed_limit").notNull(),
  direction: text("direction"), // 'both', 'forward', 'backward', or null
  country: text("country").notNull(),
  isMobile: boolean("is_mobile").notNull().default(false), // true for mobile cameras that need community verification
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trafficCameras = pgTable("traffic_cameras", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  country: text("country").notNull(), // 'ES', 'FR', 'DE', etc
  state: text("state").notNull(), // Province/State (Madrid, Málaga, etc)
  road: text("road").notNull(), // Road name (M-30, A-6, Z-40, etc)
  name: text("name").notNull(), // Location description (PK 33.00 Decrec.)
  liveImageUrl: text("live_image_url").notNull(), // http://infocar.dgt.es/etraffic/data/camaras/1360.jpg
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const truckParks = pgTable("truck_parks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address").notNull(),
  country: text("country").notNull(),
  vehicleTypes: text("vehicle_types").array().notNull().default(sql`ARRAY['car', 'motorcycle', 'truck']::text[]`), // car, motorcycle, truck, motorhome, etc
  totalSpots: integer("total_spots").notNull(),
  availableSpots: integer("available_spots").notNull(),
  amenities: text("amenities").array().notNull().default(sql`ARRAY[]::text[]`), // shower, toilet, restaurant, wifi, security, etc
  is24h: boolean("is_24h").notNull().default(false),
  isSecure: boolean("is_secure").notNull().default(false),
  pricePerHour: real("price_per_hour"),
  rating: real("rating").notNull().default(0),
  totalRatings: integer("total_ratings").notNull().default(0),
  addedBy: varchar("added_by").references(() => users.id),
  verified: boolean("verified").notNull().default(false),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const parkUpdates = pgTable("park_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parkId: varchar("park_id").notNull().references(() => truckParks.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  updateType: text("update_type").notNull(), // 'availability', 'amenities', 'rating'
  availableSpots: integer("available_spots"),
  amenities: text("amenities").array(),
  rating: integer("rating"), // 1-5 stars
  comment: text("comment"),
  photoUrl: text("photo_url"),
  xpEarned: integer("xp_earned").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cameraVerifications = pgTable("camera_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cameraId: varchar("camera_id").notNull().references(() => speedCameras.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  verification: verificationStatusEnum("verification").notNull(), // 'confirmed' | 'not_found'
  latitude: real("latitude").notNull(), // user's GPS location when verifying
  longitude: real("longitude").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(), // for upsert tracking
}, (table) => ({
  // Unique constraint: one vote per user per camera (upsert on conflict)
  uniqueUserCamera: unique().on(table.cameraId, table.userId),
}));

// Anonymous User Presence (Waze-style)
export const userPresence = pgTable("user_presence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  heading: real("heading"), // 0-360 degrees
  speed: real("speed"), // km/h
  isVisible: boolean("is_visible").notNull().default(true), // privacy: invisible mode
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  level: true,
  xp: true,
  totalKm: true,
  totalTrips: true,
  countriesVisited: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  xpEarned: true,
  startedAt: true,
  endedAt: true,
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  unlockedAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  verified: true,
  upvotes: true,
  createdAt: true,
});

export const insertSpeedCameraSchema = createInsertSchema(speedCameras).omit({
  id: true,
  createdAt: true,
});

export const insertTrafficCameraSchema = createInsertSchema(trafficCameras).omit({
  id: true,
  isActive: true,
  createdAt: true,
});

export const insertTruckParkSchema = createInsertSchema(truckParks).omit({
  id: true,
  rating: true,
  totalRatings: true,
  verified: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertParkUpdateSchema = createInsertSchema(parkUpdates).omit({
  id: true,
  xpEarned: true,
  createdAt: true,
});

export const insertCameraVerificationSchema = createInsertSchema(cameraVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Strengthen validation: latitude/longitude required for anti-abuse
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  verification: z.enum(["confirmed", "not_found"]),
});

export const insertUserPresenceSchema = createInsertSchema(userPresence).omit({
  id: true,
  lastUpdated: true,
}).extend({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert; // Required by Replit Auth
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertSpeedCamera = z.infer<typeof insertSpeedCameraSchema>;
export type SpeedCamera = typeof speedCameras.$inferSelect;
export type InsertTrafficCamera = z.infer<typeof insertTrafficCameraSchema>;
export type TrafficCamera = typeof trafficCameras.$inferSelect;
export type InsertTruckPark = z.infer<typeof insertTruckParkSchema>;
export type TruckPark = typeof truckParks.$inferSelect;
export type InsertParkUpdate = z.infer<typeof insertParkUpdateSchema>;
export type ParkUpdate = typeof parkUpdates.$inferSelect;
export type InsertCameraVerification = z.infer<typeof insertCameraVerificationSchema>;
export type CameraVerification = typeof cameraVerifications.$inferSelect;
export type InsertUserPresence = z.infer<typeof insertUserPresenceSchema>;
export type UserPresence = typeof userPresence.$inferSelect;
