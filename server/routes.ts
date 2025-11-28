import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { randomUUID } from "crypto";
import path from "path";
import express from "express";
import { createUserToken, verifyUserToken } from "./auth-utils";
import { requireAuth, optionalAuth } from "./auth-middleware";
import { geminiAssistant, type DrivingContext } from "./gemini-service";
import { 
  insertUserSchema, 
  insertTripSchema, 
  insertReportSchema,
  insertBadgeSchema,
  insertUserBadgeSchema,
  insertTruckParkSchema,
  insertParkUpdateSchema,
  insertCameraVerificationSchema,
  insertUserPresenceSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files for vanilla JS GPS app
  const publicPath = path.join(process.cwd(), 'public');
  app.use('/gps', express.static(publicPath));
  
  // Serve index.html for /gps route
  app.get('/gps', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
  
  // Config endpoint for API keys (safe for frontend)
  app.get('/api/config', (req, res) => {
    res.json({
      geoapifyKey: process.env.VITE_GEOAPIFY_API_KEY || '',
      mapboxToken: process.env.VITE_MAPBOX_ACCESS_TOKEN || ''
    });
  });

  // Simple auth - just firstName + lastName for MVP
  app.post('/api/auth/simple', async (req, res) => {
    try {
      const { firstName, lastName } = req.body;
      
      if (!firstName || !lastName) {
        return res.status(400).json({ error: "firstName and lastName are required" });
      }

      // Use normalized username for deduplication: "firstname_lastname"
      const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
      
      // Get or create user via storage layer (proper dedup)
      let user = await storage.getOrCreateUser(username);
      
      // Update firstName/lastName if needed
      if (user.firstName !== firstName || user.lastName !== lastName) {
        const updated = await storage.updateUser(user.id, { firstName, lastName });
        user = updated || user;
      }
      
      // Create signed session token for client (30-day expiry)
      const token = createUserToken(user.id);
      
      res.json({ user, token });
    } catch (error: any) {
      console.error("Simple auth error:", error);
      res.status(500).json({ error: "Failed to authenticate user" });
    }
  });

  app.post("/api/users/get-or-create", async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username || username.trim().length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters" });
      }
      
      const user = await storage.getOrCreateUser(username.trim());
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const users = await storage.getLeaderboard(limit);
      res.json(users);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/trips/user/:userId", async (req, res) => {
    try {
      const trips = await storage.getTripsByUser(req.params.userId);
      res.json(trips);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/trips/active/:userId", async (req, res) => {
    try {
      const trip = await storage.getActiveTrip(req.params.userId);
      res.json(trip || null);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/trips", requireAuth, async (req: any, res) => {
    try {
      const validatedData = insertTripSchema.parse(req.body);
      const trip = await storage.createTrip(validatedData);
      res.json(trip);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/trips/:id/end", requireAuth, async (req: any, res) => {
    try {
      const { endLocation, distance, duration } = req.body;
      
      // Validate input
      if (!endLocation || typeof distance !== 'number' || typeof duration !== 'number') {
        return res.status(400).json({ error: "endLocation, distance, and duration are required" });
      }
      
      // Anti-cheat: Validate distance bounds (max 10000km per trip, min 0.1km)
      if (distance < 0.1 || distance > 10000) {
        return res.status(400).json({ error: "Invalid distance: must be between 0.1 and 10000 km" });
      }
      
      // Validate duration (min 1 second, max 24 hours)
      if (duration < 1 || duration > 86400) {
        return res.status(400).json({ error: "Invalid duration: must be between 1 and 86400 seconds" });
      }
      
      // Validate average speed (max 200 km/h to prevent cheating)
      const avgSpeed = (distance / (duration / 3600)); // km/h
      if (avgSpeed > 200) {
        return res.status(400).json({ error: "Invalid trip: average speed exceeds 200 km/h" });
      }
      
      const trip = await storage.endTrip(req.params.id, endLocation, distance, duration);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      res.json(trip);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/badges", async (req, res) => {
    try {
      const badges = await storage.getAllBadges();
      res.json(badges);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/badges", async (req, res) => {
    try {
      const validatedData = insertBadgeSchema.parse(req.body);
      const badge = await storage.createBadge(validatedData);
      res.json(badge);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/user-badges/:userId", async (req, res) => {
    try {
      const userBadges = await storage.getUserBadges(req.params.userId);
      res.json(userBadges);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/user-badges", async (req, res) => {
    try {
      const validatedData = insertUserBadgeSchema.parse(req.body);
      const userBadge = await storage.unlockBadge(validatedData);
      res.json(userBadge);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/reports", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const reports = await storage.getReports(limit);
      res.json(reports);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/reports/user/:userId", async (req, res) => {
    try {
      const reports = await storage.getReportsByUser(req.params.userId);
      res.json(reports);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/reports/nearby", async (req, res) => {
    try {
      const latitude = parseFloat(req.query.latitude as string);
      const longitude = parseFloat(req.query.longitude as string);
      const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm as string) : 50;
      
      const reports = await storage.getNearbyReports(latitude, longitude, radiusKm);
      res.json(reports);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/reports", async (req, res) => {
    try {
      const validatedData = insertReportSchema.parse(req.body);
      const report = await storage.createReport(validatedData);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/reports/:id/upvote", async (req, res) => {
    try {
      const report = await storage.upvoteReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Speed Cameras Routes
  app.get("/api/speed-cameras", async (req, res) => {
    try {
      const cameras = await storage.getSpeedCameras();
      res.json(cameras);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/speed-cameras/nearby", async (req, res) => {
    try {
      const { lat, lon, radius, country } = req.query;
      
      if (!lat || !lon) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lon as string);
      
      // Default 2km, max 5km (architect-approved performance target)
      let radiusKm = radius ? parseFloat(radius as string) : 2;
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
      
      if (isNaN(radiusKm) || radiusKm <= 0) {
        return res.status(400).json({ error: "Invalid radius" });
      }
      
      // Enforce max radius 5km
      if (radiusKm > 5) {
        radiusKm = 5;
      }

      let cameras = await storage.getNearbySpeedCameras(latitude, longitude, radiusKm);
      
      // Optional country filter
      if (country && typeof country === 'string') {
        const countryFilter = country.toUpperCase();
        cameras = cameras.filter(cam => cam.country === countryFilter);
      }
      
      res.json(cameras);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/speed-cameras/verify", async (req, res) => {
    try {
      const validatedData = insertCameraVerificationSchema.parse(req.body);
      const result = await storage.createCameraVerification(validatedData);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Traffic Cameras Routes (live DGT cameras from Spain)
  app.get("/api/traffic-cameras", async (req, res) => {
    try {
      const { country } = req.query;
      
      let cameras;
      if (country && typeof country === 'string') {
        cameras = await storage.getTrafficCamerasByCountry(country.toUpperCase());
      } else {
        cameras = await storage.getTrafficCameras();
      }
      
      res.json(cameras);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/traffic-cameras/nearby", async (req, res) => {
    try {
      const { lat, lon, radius, country } = req.query;
      
      if (!lat || !lon) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lon as string);
      const radiusKm = radius ? parseFloat(radius as string) : 50;
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
      
      if (isNaN(radiusKm) || radiusKm <= 0) {
        return res.status(400).json({ error: "Invalid radius" });
      }

      const cameras = await storage.getNearbyTrafficCameras(
        latitude, 
        longitude, 
        radiusKm,
        country ? (country as string).toUpperCase() : undefined
      );
      
      res.json(cameras);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // TruckPark routes
  app.get("/api/truck-parks", async (req, res) => {
    try {
      const parks = await storage.getTruckParks();
      res.json(parks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/truck-parks/nearby", async (req, res) => {
    try {
      const { lat, lon, radius, vehicleType } = req.query;
      
      if (!lat || !lon) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lon as string);
      const radiusKm = radius ? parseFloat(radius as string) : 50;
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      const parks = await storage.getNearbyTruckParks(
        latitude, 
        longitude, 
        radiusKm, 
        vehicleType as string | undefined
      );
      
      res.json(parks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/truck-parks/:id", async (req, res) => {
    try {
      const park = await storage.getTruckPark(req.params.id);
      if (!park) {
        return res.status(404).json({ error: "Park not found" });
      }
      res.json(park);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/truck-parks", async (req, res) => {
    try {
      const validatedData = insertTruckParkSchema.parse(req.body);
      const park = await storage.createTruckPark(validatedData);
      res.json(park);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/truck-parks/:id", async (req, res) => {
    try {
      // Validate numeric fields to prevent inconsistent state
      const { availableSpots, totalSpots, rating } = req.body;
      
      if (availableSpots !== undefined) {
        if (typeof availableSpots !== 'number' || availableSpots < 0) {
          return res.status(400).json({ error: "availableSpots must be a non-negative number" });
        }
      }
      
      if (totalSpots !== undefined) {
        if (typeof totalSpots !== 'number' || totalSpots <= 0) {
          return res.status(400).json({ error: "totalSpots must be a positive number" });
        }
      }
      
      if (rating !== undefined) {
        if (typeof rating !== 'number' || rating < 0 || rating > 5) {
          return res.status(400).json({ error: "rating must be between 0 and 5" });
        }
      }
      
      // Ensure availableSpots never exceeds totalSpots
      const park = await storage.getTruckPark(req.params.id);
      if (!park) {
        return res.status(404).json({ error: "Park not found" });
      }
      
      const newTotal = totalSpots ?? park.totalSpots;
      const newAvailable = availableSpots ?? park.availableSpots;
      
      if (newAvailable > newTotal) {
        return res.status(400).json({ error: "availableSpots cannot exceed totalSpots" });
      }
      
      const updated = await storage.updateTruckPark(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/truck-parks/:id/updates", async (req, res) => {
    try {
      const validatedData = insertParkUpdateSchema.parse({
        ...req.body,
        parkId: req.params.id
      });
      const update = await storage.createParkUpdate(validatedData);
      res.json(update);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/truck-parks/:id/updates", async (req, res) => {
    try {
      const updates = await storage.getParkUpdates(req.params.id);
      res.json(updates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Speed Camera Verification (community-driven mobile camera validation)
  app.post("/api/speed-cameras/:id/verify", async (req, res) => {
    try {
      const validatedData = insertCameraVerificationSchema.parse({
        ...req.body,
        cameraId: req.params.id
      });
      
      const result = await storage.createCameraVerification(validatedData);
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // User Presence - Waze-style anonymous user markers
  app.post("/api/presence", async (req, res) => {
    try {
      const validatedData = insertUserPresenceSchema.parse(req.body);
      const presence = await storage.updateUserPresence(validatedData);
      res.json(presence);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/presence/nearby", async (req, res) => {
    try {
      const { latitude, longitude, radiusKm } = req.query;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ error: "latitude and longitude are required" });
      }
      
      const presences = await storage.getNearbyUserPresences(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        radiusKm ? parseFloat(radiusKm as string) : 5
      );
      
      res.json(presences);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/presence/active", async (req, res) => {
    try {
      const presences = await storage.getActiveUserPresences();
      res.json(presences);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Periodic cleanup of stale user presences (every 5 minutes)
  setInterval(async () => {
    try {
      const count = await storage.cleanupStalePresences(10);
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} stale user presences`);
      }
    } catch (error) {
      console.error('Error cleaning up stale presences:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Gemini AI Assistant - Voice command processing
  app.post("/api/ai/chat", optionalAuth, async (req, res) => {
    try {
      const { message, context } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      // Build driving context from request + auth user
      const drivingContext: DrivingContext = {
        currentLocation: context?.currentLocation,
        speed: context?.speed,
        vehicleType: context?.vehicleType,
        destination: context?.destination,
        nearbyRadars: context?.nearbyRadars,
        userId: req.userId,
        firstName: context?.firstName,
        lastName: context?.lastName,
        userXP: context?.userXP,
      };

      // Process command with Gemini
      const response = await geminiAssistant.processCommand(message, drivingContext);
      
      res.json(response);
    } catch (error: any) {
      console.error("Gemini chat error:", error);
      res.status(500).json({ error: "Failed to process AI command" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
