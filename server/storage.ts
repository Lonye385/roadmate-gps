import { 
  type User, 
  type InsertUser,
  type UpsertUser,
  type Trip,
  type InsertTrip,
  type Badge,
  type InsertBadge,
  type UserBadge,
  type InsertUserBadge,
  type Report,
  type InsertReport,
  type SpeedCamera,
  type InsertSpeedCamera,
  type TrafficCamera,
  type InsertTrafficCamera,
  type TruckPark,
  type InsertTruckPark,
  type ParkUpdate,
  type InsertParkUpdate,
  type CameraVerification,
  type InsertCameraVerification,
  type UserPresence,
  type InsertUserPresence
} from "@shared/schema";
import { randomUUID, createHash } from "crypto";
import { db } from "./db";
import { users, speedCameras, trafficCameras, trips, badges, reports, userPresence } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hashedPassword: string): boolean {
  return hashPassword(password) === hashedPassword;
}

export interface IStorage {
  // User operations (Replit Auth required)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>; // Required by Replit Auth
  
  // Legacy user operations
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getOrCreateUser(username: string): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  verifyUserPassword(user: User, password: string): Promise<boolean>;
  getLeaderboard(limit?: number): Promise<User[]>;
  
  getTripsByUser(userId: string): Promise<Trip[]>;
  getActiveTrip(userId: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined>;
  endTrip(id: string, endLocation: string, distance: number, duration: number): Promise<Trip | undefined>;
  
  getAllBadges(): Promise<Badge[]>;
  getBadge(id: string): Promise<Badge | undefined>;
  createBadge(badge: InsertBadge): Promise<Badge>;
  
  getUserBadges(userId: string): Promise<UserBadge[]>;
  unlockBadge(userBadge: InsertUserBadge): Promise<UserBadge>;
  
  getReports(limit?: number): Promise<Report[]>;
  getReportsByUser(userId: string): Promise<Report[]>;
  getNearbyReports(latitude: number, longitude: number, radiusKm?: number): Promise<Report[]>;
  createReport(report: InsertReport): Promise<Report>;
  upvoteReport(id: string): Promise<Report | undefined>;
  
  getSpeedCameras(): Promise<SpeedCamera[]>;
  getNearbySpeedCameras(latitude: number, longitude: number, radiusKm?: number, country?: string): Promise<SpeedCamera[]>;
  createSpeedCamera(camera: InsertSpeedCamera): Promise<SpeedCamera>;
  batchImportSpeedCameras(cameras: InsertSpeedCamera[], chunkSize?: number): Promise<number>;
  
  getTrafficCameras(): Promise<TrafficCamera[]>;
  getTrafficCamerasByCountry(country: string): Promise<TrafficCamera[]>;
  getNearbyTrafficCameras(latitude: number, longitude: number, radiusKm?: number, country?: string): Promise<TrafficCamera[]>;
  batchImportTrafficCameras(cameras: InsertTrafficCamera[]): Promise<number>;
  
  getTruckParks(): Promise<TruckPark[]>;
  getTruckPark(id: string): Promise<TruckPark | undefined>;
  getNearbyTruckParks(latitude: number, longitude: number, radiusKm?: number, vehicleType?: string): Promise<TruckPark[]>;
  createTruckPark(park: InsertTruckPark): Promise<TruckPark>;
  updateTruckPark(id: string, updates: Partial<TruckPark>): Promise<TruckPark | undefined>;
  
  getParkUpdates(parkId: string): Promise<ParkUpdate[]>;
  createParkUpdate(update: InsertParkUpdate): Promise<ParkUpdate>;
  
  createCameraVerification(verification: InsertCameraVerification): Promise<{
    success: boolean;
    cameraDeleted: boolean;
    notFoundCount: number;
    confirmedCount: number;
    message?: string;
  }>;
  
  updateUserPresence(presence: InsertUserPresence): Promise<UserPresence>;
  getActiveUserPresences(olderThanMinutes?: number): Promise<UserPresence[]>;
  getNearbyUserPresences(latitude: number, longitude: number, radiusKm?: number): Promise<UserPresence[]>;
  cleanupStalePresences(olderThanMinutes: number): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private trips: Map<string, Trip>;
  private badges: Map<string, Badge>;
  private userBadges: Map<string, UserBadge>;
  private reports: Map<string, Report>;
  private speedCameras: Map<string, SpeedCamera>;
  private speedCameraGrid: Map<string, string[]>; // Grid index: "lat_lon" -> camera IDs
  private trafficCameras: Map<string, TrafficCamera>; // Traffic camera storage
  private truckParks: Map<string, TruckPark>;
  private parkUpdates: Map<string, ParkUpdate>;
  private cameraVerifications: Map<string, CameraVerification>; // All verifications
  private cameraVerificationsByCamera: Map<string, string[]>; // cameraId -> verification IDs (for quick lookup)
  private userPresences: Map<string, UserPresence>; // userId -> presence (one per user)

  constructor() {
    this.users = new Map();
    this.trips = new Map();
    this.badges = new Map();
    this.userBadges = new Map();
    this.reports = new Map();
    this.speedCameras = new Map();
    this.speedCameraGrid = new Map();
    this.trafficCameras = new Map();
    this.truckParks = new Map();
    this.parkUpdates = new Map();
    this.cameraVerifications = new Map();
    this.cameraVerificationsByCamera = new Map();
    this.userPresences = new Map();
    
    this.seedBadges();
    this.seedSpeedCameras();
    this.seedTruckParks();
  }

  // Haversine distance calculation (reusable helper)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  // Grid index helper: quantize lat/lon to 0.25° buckets
  private getGridKey(lat: number, lon: number): string {
    const gridSize = 0.25; // ~25km at equator
    const latBucket = Math.floor(lat / gridSize);
    const lonBucket = Math.floor(lon / gridSize);
    return `${latBucket}_${lonBucket}`;
  }

  // Add camera to grid index
  private addToGrid(camera: SpeedCamera): void {
    const key = this.getGridKey(camera.latitude, camera.longitude);
    const existing = this.speedCameraGrid.get(key) || [];
    existing.push(camera.id);
    this.speedCameraGrid.set(key, existing);
  }

  // Get nearby grid cells (including adjacent cells for radius coverage)
  private getNearbyGridKeys(lat: number, lon: number, radiusKm: number): string[] {
    const gridSize = 0.25;
    
    // Calculate angular span in degrees FIRST (architect-approved fix)
    const latRangeDeg = radiusKm / 111; // ~111km per degree latitude
    const cosLat = Math.max(Math.cos(lat * Math.PI / 180), 0.1); // Clamp for poles
    const lonRangeDeg = radiusKm / (111 * cosLat);
    
    // THEN divide by gridSize to get bucket range
    const latBucketRange = Math.ceil(latRangeDeg / gridSize);
    const lonBucketRange = Math.ceil(lonRangeDeg / gridSize);
    
    const keys: string[] = [];
    const centerLatBucket = Math.floor(lat / gridSize);
    const centerLonBucket = Math.floor(lon / gridSize);
    
    for (let latOffset = -latBucketRange; latOffset <= latBucketRange; latOffset++) {
      for (let lonOffset = -lonBucketRange; lonOffset <= lonBucketRange; lonOffset++) {
        keys.push(`${centerLatBucket + latOffset}_${centerLonBucket + lonOffset}`);
      }
    }
    
    return keys;
  }

  private seedSpeedCameras() {
    const defaultCameras: InsertSpeedCamera[] = [
      // Portugal - A1 (Porto-Lisboa)
      { type: 'fixed', latitude: 41.16, longitude: -8.61, location: 'A1 Porto Norte', speedLimit: 120, direction: 'both', country: 'PT', isActive: true },
      { type: 'fixed', latitude: 40.64, longitude: -8.65, location: 'A1 Aveiro Sul', speedLimit: 120, direction: 'both', country: 'PT', isActive: true },
      { type: 'fixed', latitude: 39.82, longitude: -8.82, location: 'A1 Leiria', speedLimit: 120, direction: 'both', country: 'PT', isActive: true },
      { type: 'fixed', latitude: 38.78, longitude: -9.13, location: 'A1 Lisboa Norte', speedLimit: 120, direction: 'both', country: 'PT', isActive: true },
      
      // Portugal - A2 (Lisboa-Algarve)
      { type: 'fixed', latitude: 38.62, longitude: -9.01, location: 'A2 Almada', speedLimit: 120, direction: 'both', country: 'PT', isActive: true },
      { type: 'fixed', latitude: 38.01, longitude: -8.57, location: 'A2 Grândola', speedLimit: 120, direction: 'both', country: 'PT', isActive: true },
      { type: 'fixed', latitude: 37.37, longitude: -8.22, location: 'A2 Castro Marim', speedLimit: 120, direction: 'both', country: 'PT', isActive: true },
      
      // Portugal - Lisboa urban
      { type: 'redlight', latitude: 38.736, longitude: -9.142, location: 'Lisboa - Av. da República', speedLimit: 50, direction: 'both', country: 'PT', isActive: true },
      { type: 'fixed', latitude: 38.745, longitude: -9.160, location: 'Lisboa - 2ª Circular', speedLimit: 90, direction: 'both', country: 'PT', isActive: true },
      
      // Spain - Madrid
      { type: 'fixed', latitude: 40.416, longitude: -3.703, location: 'Madrid - M-30', speedLimit: 90, direction: 'both', country: 'ES', isActive: true },
      { type: 'section', latitude: 40.45, longitude: -3.68, location: 'Madrid - A-2', speedLimit: 120, direction: 'both', country: 'ES', isActive: true },
      
      // Germany - Autobahn (rare speed cameras)
      { type: 'fixed', latitude: 48.775, longitude: 9.182, location: 'Stuttgart - A8', speedLimit: 120, direction: 'both', country: 'DE', isActive: true },
      { type: 'mobile', latitude: 51.165, longitude: 10.451, location: 'Göttingen - A7', speedLimit: 130, direction: 'both', country: 'DE', isActive: true, isMobile: true },
      
      // France
      { type: 'fixed', latitude: 48.856, longitude: 2.352, location: 'Paris - Périphérique', speedLimit: 70, direction: 'both', country: 'FR', isActive: true },
      { type: 'section', latitude: 43.604, longitude: 1.444, location: 'Toulouse - A61', speedLimit: 130, direction: 'both', country: 'FR', isActive: true },
      
      // Portugal - Mobile Cameras (for testing community verification)
      { type: 'mobile', latitude: 38.736, longitude: -9.142, location: 'Lisboa - Marquês de Pombal', speedLimit: 50, direction: 'both', country: 'PT', isActive: true, isMobile: true },
      { type: 'mobile', latitude: 41.160, longitude: -8.630, location: 'Porto - VCI', speedLimit: 100, direction: 'both', country: 'PT', isActive: true, isMobile: true },
      { type: 'mobile', latitude: 38.708, longitude: -9.136, location: 'Lisboa - Av. da Liberdade', speedLimit: 50, direction: 'both', country: 'PT', isActive: true, isMobile: true },
    ];
    
    for (const camera of defaultCameras) {
      this.createSpeedCamera(camera);
    }
  }

  private seedBadges() {
    const defaultBadges: InsertBadge[] = [
      {
        name: "First Steps",
        description: "Complete your first trip",
        iconType: "footprints",
        category: "trips",
        requirement: { trips: 1 },
        xpReward: 100
      },
      {
        name: "Road Warrior",
        description: "Drive 100km",
        iconType: "car",
        category: "distance",
        requirement: { km: 100 },
        xpReward: 200
      },
      {
        name: "Explorer",
        description: "Visit 3 different countries",
        iconType: "globe",
        category: "countries",
        requirement: { countries: 3 },
        xpReward: 300
      },
      {
        name: "Safety First",
        description: "Report 5 traffic alerts",
        iconType: "shield",
        category: "reports",
        requirement: { reports: 5 },
        xpReward: 150
      },
      {
        name: "Speed Demon",
        description: "Drive 500km",
        iconType: "zap",
        category: "distance",
        requirement: { km: 500 },
        xpReward: 500
      },
      {
        name: "Globe Trotter",
        description: "Visit 10 different countries",
        iconType: "map",
        category: "countries",
        requirement: { countries: 10 },
        xpReward: 1000
      },
      {
        name: "Community Verifier",
        description: "Verify 10 speed cameras",
        iconType: "check-circle",
        category: "verifications",
        requirement: { verifications: 10 },
        xpReward: 500
      }
    ];

    defaultBadges.forEach(badge => {
      const id = randomUUID();
      this.badges.set(id, { ...badge, id, xpReward: badge.xpReward ?? 0 });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id!);
    
    if (existingUser) {
      // Update existing user
      const updatedUser: User = {
        ...existingUser,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(userData.id!, updatedUser);
      return updatedUser;
    } else {
      // Create new user from Replit Auth
      const newUser: User = {
        id: userData.id!,
        email: userData.email ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        username: userData.username ?? null,
        level: 1,
        xp: 0,
        totalKm: 0,
        totalTrips: 0,
        countriesVisited: [],
        vehicleProfile: "car",
        countryFlag: null,
        tagline: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(newUser.id, newUser);
      return newUser;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getOrCreateUser(username: string): Promise<User> {
    const existingUser = await this.getUserByUsername(username);
    if (existingUser) return existingUser;
    
    // Create minimal user for community testing (no password, no email)
    const newUser: InsertUser = {
      username,
      password: randomUUID(), // Random password (won't be used)
      email: `${username}@roadmate.temp`,
      vehicleProfile: "car"
    };
    
    return this.createUser(newUser);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const hashedPassword = hashPassword(insertUser.password);
    const user: User = { 
      ...insertUser,
      password: hashedPassword,
      id,
      level: 1,
      xp: 0,
      totalKm: 0,
      totalTrips: 0,
      countriesVisited: [],
      vehicleProfile: insertUser.vehicleProfile ?? "car",
      avatarUrl: insertUser.avatarUrl ?? null,
      countryFlag: insertUser.countryFlag ?? null,
      tagline: insertUser.tagline ?? null,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async verifyUserPassword(user: User, password: string): Promise<boolean> {
    return verifyPassword(password, user.password);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    if (updates.password) {
      updates.password = hashPassword(updates.password);
    }
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getLeaderboard(limit: number = 50): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => b.totalKm - a.totalKm)
      .slice(0, limit);
  }

  async getTripsByUser(userId: string): Promise<Trip[]> {
    return Array.from(this.trips.values())
      .filter(trip => trip.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async getActiveTrip(userId: string): Promise<Trip | undefined> {
    return Array.from(this.trips.values())
      .find(trip => trip.userId === userId && trip.isActive);
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const id = randomUUID();
    const trip: Trip = {
      ...insertTrip,
      id,
      endLocation: insertTrip.endLocation ?? null,
      distance: insertTrip.distance ?? 0,
      duration: insertTrip.duration ?? 0,
      countriesCrossed: insertTrip.countriesCrossed ?? [],
      isActive: insertTrip.isActive ?? true,
      xpEarned: 0,
      startedAt: new Date(),
      endedAt: null
    };
    this.trips.set(id, trip);
    return trip;
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined> {
    const trip = this.trips.get(id);
    if (!trip) return undefined;
    
    const updatedTrip = { ...trip, ...updates };
    this.trips.set(id, updatedTrip);
    return updatedTrip;
  }

  async endTrip(id: string, endLocation: string, distance: number, duration: number): Promise<Trip | undefined> {
    const trip = this.trips.get(id);
    if (!trip) return undefined;

    const xpEarned = Math.floor(distance * 10);
    
    const updatedTrip = { 
      ...trip, 
      endLocation,
      distance,
      duration,
      xpEarned,
      isActive: false,
      endedAt: new Date()
    };
    this.trips.set(id, updatedTrip);

    const user = this.users.get(trip.userId);
    if (user) {
      const newCountries = Array.from(new Set([...user.countriesVisited, ...trip.countriesCrossed]));
      await this.updateUser(user.id, {
        totalKm: user.totalKm + distance,
        totalTrips: user.totalTrips + 1,
        xp: user.xp + xpEarned,
        level: Math.floor((user.xp + xpEarned) / 1000) + 1,
        countriesVisited: newCountries
      });
    }

    return updatedTrip;
  }

  async getAllBadges(): Promise<Badge[]> {
    return Array.from(this.badges.values());
  }

  async getBadge(id: string): Promise<Badge | undefined> {
    return this.badges.get(id);
  }

  async createBadge(insertBadge: InsertBadge): Promise<Badge> {
    const id = randomUUID();
    const badge: Badge = { ...insertBadge, id, xpReward: insertBadge.xpReward ?? 0 };
    this.badges.set(id, badge);
    return badge;
  }

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return Array.from(this.userBadges.values())
      .filter(ub => ub.userId === userId);
  }

  async unlockBadge(insertUserBadge: InsertUserBadge): Promise<UserBadge> {
    const id = randomUUID();
    const userBadge: UserBadge = {
      ...insertUserBadge,
      id,
      unlockedAt: new Date()
    };
    this.userBadges.set(id, userBadge);

    const badge = this.badges.get(insertUserBadge.badgeId);
    if (badge) {
      const user = this.users.get(insertUserBadge.userId);
      if (user) {
        await this.updateUser(user.id, {
          xp: user.xp + badge.xpReward,
          level: Math.floor((user.xp + badge.xpReward) / 1000) + 1
        });
      }
    }

    return userBadge;
  }

  async getReports(limit: number = 100): Promise<Report[]> {
    return Array.from(this.reports.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getReportsByUser(userId: string): Promise<Report[]> {
    return Array.from(this.reports.values())
      .filter(report => report.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getNearbyReports(latitude: number, longitude: number, radiusKm: number = 50): Promise<Report[]> {
    const toRad = (deg: number) => deg * Math.PI / 180;
    
    return Array.from(this.reports.values()).filter(report => {
      const R = 6371;
      const dLat = toRad(report.latitude - latitude);
      const dLon = toRad(report.longitude - longitude);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(latitude)) * Math.cos(toRad(report.latitude)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return distance <= radiusKm;
    });
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const id = randomUUID();
    const report: Report = {
      ...insertReport,
      id,
      description: insertReport.description ?? null,
      severity: insertReport.severity ?? "medium",
      verified: false,
      upvotes: 0,
      expiresAt: insertReport.expiresAt ?? null,
      createdAt: new Date()
    };
    this.reports.set(id, report);
    return report;
  }

  async upvoteReport(id: string): Promise<Report | undefined> {
    const report = this.reports.get(id);
    if (!report) return undefined;
    
    const updatedReport = { ...report, upvotes: report.upvotes + 1 };
    this.reports.set(id, updatedReport);
    return updatedReport;
  }

  async getSpeedCameras(): Promise<SpeedCamera[]> {
    return Array.from(this.speedCameras.values())
      .filter(camera => camera.isActive);
  }

  async getNearbySpeedCameras(latitude: number, longitude: number, radiusKm: number = 10): Promise<SpeedCamera[]> {
    // Enforce max radius (architect-approved: ≤5km, default 2km)
    const maxRadius = 5;
    const actualRadius = Math.min(radiusKm, maxRadius);
    
    const toRad = (deg: number) => deg * Math.PI / 180;
    
    // Use grid index to reduce search space
    const gridKeys = this.getNearbyGridKeys(latitude, longitude, actualRadius);
    const candidateIds = new Set<string>();
    
    for (const key of gridKeys) {
      const ids = this.speedCameraGrid.get(key);
      if (ids) {
        ids.forEach(id => candidateIds.add(id));
      }
    }
    
    // Filter candidates with precise Haversine distance
    const candidates: SpeedCamera[] = [];
    for (const id of Array.from(candidateIds)) {
      const camera = this.speedCameras.get(id);
      if (camera && camera.isActive) {
        candidates.push(camera);
      }
    }
    
    const filtered = candidates.filter(camera => {
      const R = 6371;
      const dLat = toRad(camera.latitude - latitude);
      const dLon = toRad(camera.longitude - longitude);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(latitude)) * Math.cos(toRad(camera.latitude)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return distance <= actualRadius;
    });
    
    // Deduplicate by ID (architect fix - avoid duplicate alerts)
    const seen = new Set<string>();
    return filtered.filter(camera => {
      if (seen.has(camera.id)) {
        return false;
      }
      seen.add(camera.id);
      return true;
    });
  }

  async createSpeedCamera(insertCamera: InsertSpeedCamera): Promise<SpeedCamera> {
    const id = randomUUID();
    const camera: SpeedCamera = {
      ...insertCamera,
      id,
      direction: insertCamera.direction ?? null,
      isActive: insertCamera.isActive ?? true,
      isMobile: insertCamera.isMobile ?? (insertCamera.type === 'mobile'), // Auto-infer from type
      createdAt: new Date()
    };
    this.speedCameras.set(id, camera);
    
    // Add to grid index
    this.addToGrid(camera);
    
    return camera;
  }

  async batchImportSpeedCameras(cameras: InsertSpeedCamera[], chunkSize: number = 1000): Promise<number> {
    // Clear existing cameras and grid to avoid duplicates (architect fix)
    this.speedCameras.clear();
    this.speedCameraGrid.clear();
    
    let imported = 0;
    
    // Process in chunks to avoid blocking event loop
    for (let i = 0; i < cameras.length; i += chunkSize) {
      const chunk = cameras.slice(i, i + chunkSize);
      
      for (const cameraData of chunk) {
        await this.createSpeedCamera(cameraData);
        imported++;
      }
      
      // Yield control to event loop after each chunk
      if (i + chunkSize < cameras.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    console.log(`✅ Batch import complete: ${imported} speed cameras loaded`);
    return imported;
  }

  // TrafficCamera methods
  async getTrafficCameras(): Promise<TrafficCamera[]> {
    return Array.from(this.trafficCameras.values())
      .filter(camera => camera.isActive);
  }

  async getTrafficCamerasByCountry(country: string): Promise<TrafficCamera[]> {
    return Array.from(this.trafficCameras.values())
      .filter(camera => camera.isActive && camera.country === country);
  }

  async getNearbyTrafficCameras(latitude: number, longitude: number, radiusKm: number = 50, country?: string): Promise<TrafficCamera[]> {
    const toRad = (deg: number) => deg * Math.PI / 180;
    
    let cameras = Array.from(this.trafficCameras.values());
    
    // Filter by country if specified
    if (country) {
      cameras = cameras.filter(camera => camera.country === country);
    }
    
    // Filter by distance and active status
    const filtered = cameras.filter(camera => {
      if (!camera.isActive) return false;
      
      const R = 6371;
      const dLat = toRad(camera.latitude - latitude);
      const dLon = toRad(camera.longitude - longitude);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(latitude)) * Math.cos(toRad(camera.latitude)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      return distance <= radiusKm;
    });
    
    // Sort by distance (closest first)
    return filtered.sort((a, b) => {
      const distA = this.calculateDistance(latitude, longitude, a.latitude, a.longitude);
      const distB = this.calculateDistance(latitude, longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  async batchImportTrafficCameras(cameras: InsertTrafficCamera[]): Promise<number> {
    // Clear existing traffic cameras to avoid duplicates
    this.trafficCameras.clear();
    
    let imported = 0;
    
    for (const cameraData of cameras) {
      const id = randomUUID();
      const camera: TrafficCamera = {
        ...cameraData,
        id,
        isActive: true,
        createdAt: new Date()
      };
      this.trafficCameras.set(id, camera);
      imported++;
    }
    
    console.log(`📹 Traffic cameras imported: ${imported} cameras`);
    return imported;
  }

  // TruckPark methods
  async getTruckParks(): Promise<TruckPark[]> {
    return Array.from(this.truckParks.values());
  }

  async getTruckPark(id: string): Promise<TruckPark | undefined> {
    return this.truckParks.get(id);
  }

  async getNearbyTruckParks(latitude: number, longitude: number, radiusKm: number = 50, vehicleType?: string): Promise<TruckPark[]> {
    const allParks = Array.from(this.truckParks.values());
    
    return allParks.filter(park => {
      const distance = this.calculateDistance(latitude, longitude, park.latitude, park.longitude);
      const withinRadius = distance <= radiusKm;
      const matchesVehicle = !vehicleType || park.vehicleTypes.includes(vehicleType);
      return withinRadius && matchesVehicle;
    }).sort((a, b) => {
      const distA = this.calculateDistance(latitude, longitude, a.latitude, a.longitude);
      const distB = this.calculateDistance(latitude, longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  async createTruckPark(insertPark: InsertTruckPark): Promise<TruckPark> {
    const id = randomUUID();
    const park: TruckPark = {
      ...insertPark,
      id,
      vehicleTypes: insertPark.vehicleTypes ?? [],
      amenities: insertPark.amenities ?? [],
      pricePerHour: insertPark.pricePerHour ?? null,
      addedBy: insertPark.addedBy ?? null,
      is24h: insertPark.is24h ?? false,
      isSecure: insertPark.isSecure ?? false,
      rating: 0,
      totalRatings: 0,
      verified: false,
      lastUpdated: new Date(),
      createdAt: new Date()
    };
    this.truckParks.set(id, park);
    return park;
  }

  async updateTruckPark(id: string, updates: Partial<TruckPark>): Promise<TruckPark | undefined> {
    const park = this.truckParks.get(id);
    if (!park) return undefined;
    
    const updated = { ...park, ...updates, lastUpdated: new Date() };
    this.truckParks.set(id, updated);
    return updated;
  }

  // ParkUpdate methods
  async getParkUpdates(parkId: string): Promise<ParkUpdate[]> {
    return Array.from(this.parkUpdates.values())
      .filter(update => update.parkId === parkId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createParkUpdate(insertUpdate: InsertParkUpdate): Promise<ParkUpdate> {
    const id = randomUUID();
    const xpEarned = 5; // Base XP for community contribution
    
    const update: ParkUpdate = {
      ...insertUpdate,
      id,
      availableSpots: insertUpdate.availableSpots ?? null,
      amenities: insertUpdate.amenities ?? null,
      rating: insertUpdate.rating ?? null,
      comment: insertUpdate.comment ?? null,
      photoUrl: insertUpdate.photoUrl ?? null,
      xpEarned,
      createdAt: new Date()
    };
    this.parkUpdates.set(id, update);
    
    // Update the park based on the update type
    const park = this.truckParks.get(insertUpdate.parkId);
    if (park) {
      if (insertUpdate.updateType === 'availability' && insertUpdate.availableSpots !== null && insertUpdate.availableSpots !== undefined) {
        await this.updateTruckPark(park.id, { availableSpots: insertUpdate.availableSpots });
      } else if (insertUpdate.updateType === 'rating' && insertUpdate.rating !== null && insertUpdate.rating !== undefined) {
        const newTotalRatings = park.totalRatings + 1;
        const newRating = ((park.rating * park.totalRatings) + insertUpdate.rating) / newTotalRatings;
        await this.updateTruckPark(park.id, { rating: newRating, totalRatings: newTotalRatings });
      }
    }
    
    // Award XP to user
    const user = this.users.get(insertUpdate.userId);
    if (user) {
      await this.updateUser(user.id, { xp: user.xp + xpEarned });
    }
    
    return update;
  }

  // CameraVerification methods
  async createCameraVerification(insertVerification: InsertCameraVerification): Promise<{
    success: boolean;
    cameraDeleted: boolean;
    notFoundCount: number;
    confirmedCount: number;
    message?: string;
    xpGained?: number;
    newLevel?: number;
    badgeUnlocked?: string;
  }> {
    const camera = this.speedCameras.get(insertVerification.cameraId);
    
    // Validate camera exists and is mobile
    if (!camera) {
      return { success: false, cameraDeleted: false, notFoundCount: 0, confirmedCount: 0, message: 'Camera not found' };
    }
    
    if (!camera.isMobile || !camera.isActive) {
      return { success: false, cameraDeleted: false, notFoundCount: 0, confirmedCount: 0, message: 'Camera is not mobile or not active' };
    }
    
    // Distance validation: user must be within ~150m of camera
    const distance = this.calculateDistance(
      insertVerification.latitude,
      insertVerification.longitude,
      camera.latitude,
      camera.longitude
    ) * 1000; // Convert km to meters
    
    if (distance > 150) {
      return { 
        success: false, 
        cameraDeleted: false, 
        notFoundCount: 0, 
        confirmedCount: 0, 
        message: `Too far from camera (${Math.round(distance)}m). Must be within 150m to verify.` 
      };
    }
    
    // UPSERT logic: check if user already verified this camera
    const existingVerifications = Array.from(this.cameraVerifications.values());
    const existingVerification = existingVerifications.find(
      v => v.cameraId === insertVerification.cameraId && v.userId === insertVerification.userId
    );
    
    let verificationId: string;
    
    const isNewVerification = !existingVerification;
    
    if (existingVerification) {
      // Update existing verification
      verificationId = existingVerification.id;
      const updated: CameraVerification = {
        ...existingVerification,
        verification: insertVerification.verification,
        latitude: insertVerification.latitude,
        longitude: insertVerification.longitude,
        updatedAt: new Date()
      };
      this.cameraVerifications.set(verificationId, updated);
    } else {
      // Create new verification
      verificationId = randomUUID();
      const verification: CameraVerification = {
        ...insertVerification,
        id: verificationId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.cameraVerifications.set(verificationId, verification);
      
      // Update index
      const cameraVerifications = this.cameraVerificationsByCamera.get(insertVerification.cameraId) || [];
      cameraVerifications.push(verificationId);
      this.cameraVerificationsByCamera.set(insertVerification.cameraId, cameraVerifications);
    }
    
    // Award +50 XP for EVERY verification (new or updated) - Community Verifier reward
    let xpGained = 0;
    let newLevel: number | undefined;
    let badgeUnlocked: string | undefined;
    
    const user = this.users.get(insertVerification.userId);
    if (user) {
      xpGained = 50;
      const newXp = user.xp + xpGained;
      newLevel = Math.floor(newXp / 1000) + 1;
      await this.updateUser(user.id, {
        xp: newXp,
        level: newLevel
      });
      
      // Count total verifications by this user
      const userVerifications = Array.from(this.cameraVerifications.values())
        .filter(v => v.userId === insertVerification.userId);
      
      // Unlock "Community Verifier" badge at 10 verifications
      if (userVerifications.length >= 10) {
        const communityVerifierBadge = Array.from(this.badges.values())
          .find(b => b.name === "Community Verifier");
        
        if (communityVerifierBadge) {
          // Check if user already has this badge
          const userHasBadge = Array.from(this.userBadges.values())
            .some(ub => ub.userId === user.id && ub.badgeId === communityVerifierBadge.id);
          
          if (!userHasBadge) {
            // Award badge
            await this.unlockBadge({ userId: user.id, badgeId: communityVerifierBadge.id });
            badgeUnlocked = "Community Verifier";
          }
        }
      }
    }
    
    // Count votes: get all verifications for this camera (from unique users)
    const cameraVerificationIds = this.cameraVerificationsByCamera.get(insertVerification.cameraId) || [];
    const allCameraVerifications = cameraVerificationIds
      .map(id => this.cameraVerifications.get(id))
      .filter((v): v is CameraVerification => v !== undefined);
    
    // Count unique users for each vote type
    const notFoundUsers = new Set(
      allCameraVerifications
        .filter(v => v.verification === 'not_found')
        .map(v => v.userId)
    );
    
    const confirmedUsers = new Set(
      allCameraVerifications
        .filter(v => v.verification === 'confirmed')
        .map(v => v.userId)
    );
    
    const notFoundCount = notFoundUsers.size;
    const confirmedCount = confirmedUsers.size;
    
    // Soft delete camera if >= 3 unique users report "not_found"
    let cameraDeleted = false;
    if (notFoundCount >= 3) {
      await this.updateSpeedCamera(camera.id, { isActive: false });
      cameraDeleted = true;
    }
    
    return {
      success: true,
      cameraDeleted,
      notFoundCount,
      confirmedCount,
      message: cameraDeleted ? 'Camera deactivated due to community reports' : 'Verification recorded',
      xpGained,
      newLevel,
      badgeUnlocked
    };
  }
  
  // Helper method to update speed camera (soft delete support)
  private async updateSpeedCamera(id: string, updates: Partial<SpeedCamera>): Promise<SpeedCamera | undefined> {
    const camera = this.speedCameras.get(id);
    if (!camera) return undefined;
    
    const updated = { ...camera, ...updates };
    this.speedCameras.set(id, updated);
    
    // If deactivating, remove from grid index
    if (updates.isActive === false) {
      const gridKey = `${Math.floor(camera.latitude)}_${Math.floor(camera.longitude)}`;
      const gridCameras = this.speedCameraGrid.get(gridKey) || [];
      const filteredCameras = gridCameras.filter(cameraId => cameraId !== id);
      this.speedCameraGrid.set(gridKey, filteredCameras);
    }
    
    return updated;
  }

  // Seed some initial truck parks
  private seedTruckParks() {
    const defaultParks: InsertTruckPark[] = [
      // Portugal - Lisboa
      {
        name: "Parque Industrial Alfragide",
        latitude: 38.7294,
        longitude: -9.2206,
        address: "Av. de Portugal, 2610 Amadora",
        country: "PT",
        vehicleTypes: ["truck", "motorhome"],
        totalSpots: 50,
        availableSpots: 35,
        amenities: ["toilet", "shower", "wifi", "security"],
        is24h: true,
        isSecure: true,
        pricePerHour: 2.5,
        addedBy: null
      },
      // Portugal - Porto
      {
        name: "Zona Industrial Maia",
        latitude: 41.2316,
        longitude: -8.6279,
        address: "Maia, Porto",
        country: "PT",
        vehicleTypes: ["truck", "motorhome", "car"],
        totalSpots: 30,
        availableSpots: 20,
        amenities: ["toilet", "restaurant", "security"],
        is24h: true,
        isSecure: true,
        pricePerHour: 2.0,
        addedBy: null
      },
      // Spain - Madrid
      {
        name: "Parque Logístico Coslada",
        latitude: 40.4284,
        longitude: -3.5562,
        address: "Coslada, Madrid",
        country: "ES",
        vehicleTypes: ["truck", "motorhome"],
        totalSpots: 100,
        availableSpots: 75,
        amenities: ["toilet", "shower", "restaurant", "wifi", "security"],
        is24h: true,
        isSecure: true,
        pricePerHour: 3.0,
        addedBy: null
      },
      // France - Paris
      {
        name: "Aire de Repos A1 Senlis",
        latitude: 49.2083,
        longitude: 2.5858,
        address: "A1, Senlis",
        country: "FR",
        vehicleTypes: ["truck", "motorhome", "car"],
        totalSpots: 80,
        availableSpots: 60,
        amenities: ["toilet", "shower", "restaurant", "wifi"],
        is24h: true,
        isSecure: false,
        pricePerHour: 0,
        addedBy: null
      }
    ];

    defaultParks.forEach(park => {
      this.createTruckPark(park);
    });
    
    console.log(`🅿️ Seeded ${defaultParks.length} truck parks`);
  }

  // User Presence Methods (Waze-style anonymous tracking)
  async updateUserPresence(presence: InsertUserPresence): Promise<UserPresence> {
    const existing = this.userPresences.get(presence.userId);
    
    const userPresence: UserPresence = {
      id: existing?.id || randomUUID(),
      userId: presence.userId,
      latitude: presence.latitude,
      longitude: presence.longitude,
      heading: presence.heading ?? null,
      speed: presence.speed ?? null,
      isVisible: presence.isVisible ?? true,
      lastUpdated: new Date(),
    };

    this.userPresences.set(presence.userId, userPresence);
    return userPresence;
  }

  async getActiveUserPresences(olderThanMinutes: number = 10): Promise<UserPresence[]> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    return Array.from(this.userPresences.values()).filter(presence => 
      presence.isVisible && presence.lastUpdated >= cutoffTime
    );
  }

  async getNearbyUserPresences(latitude: number, longitude: number, radiusKm: number = 5): Promise<UserPresence[]> {
    const cutoffTime = new Date(Date.now() - 10 * 60 * 1000); // Last 10 minutes
    
    return Array.from(this.userPresences.values()).filter(presence => {
      if (!presence.isVisible || presence.lastUpdated < cutoffTime) {
        return false;
      }
      
      const distance = this.calculateDistance(
        latitude,
        longitude,
        presence.latitude,
        presence.longitude
      );
      
      return distance <= radiusKm;
    });
  }

  async cleanupStalePresences(olderThanMinutes: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    let count = 0;
    
    const entries = Array.from(this.userPresences.entries());
    for (const [userId, presence] of entries) {
      if (presence.lastUpdated < cutoffTime) {
        this.userPresences.delete(userId);
        count++;
      }
    }
    
    return count;
  }
}

// DatabaseStorage - Production storage using PostgreSQL
class DatabaseStorage implements IStorage {
  // ========================================
  // USER METHODS (Implemented)
  // ========================================
  
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const now = new Date();
    
    // Prepare user data with defaults
    const userToUpsert = {
      id: userData.id,
      email: userData.email ?? null,
      username: userData.username ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      level: userData.level ?? 1,
      xp: userData.xp ?? 0,
      totalKm: userData.totalKm ?? 0,
      vehicleProfile: userData.vehicleProfile ?? 'car',
      updatedAt: now,
    };

    const [user] = await db
      .insert(users)
      .values(userToUpsert)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userToUpsert.email,
          username: userToUpsert.username,
          firstName: userToUpsert.firstName,
          lastName: userToUpsert.lastName,
          profileImageUrl: userToUpsert.profileImageUrl,
          updatedAt: now,
        },
      })
      .returning();

    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async getOrCreateUser(username: string): Promise<User> {
    const existing = await this.getUserByUsername(username);
    if (existing) {
      return existing;
    }

    const [user] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        username,
        email: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        level: 1,
        xp: 0,
        totalKm: 0,
        vehicleProfile: 'car',
        updatedAt: new Date(),
      })
      .returning();

    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        ...userData,
        level: 1,
        xp: 0,
        totalKm: 0,
        updatedAt: new Date(),
      })
      .returning();

    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return user;
  }

  async verifyUserPassword(user: User, password: string): Promise<boolean> {
    // Password verification not used with Replit Auth
    return false;
  }

  async getLeaderboard(limit: number = 10): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.totalKm))
      .limit(limit);
  }

  // ========================================
  // TRIP METHODS (Implemented)
  // ========================================
  
  async getTripsByUser(userId: string): Promise<Trip[]> {
    return await db
      .select()
      .from(trips)
      .where(eq(trips.userId, userId))
      .orderBy(desc(trips.startedAt));
  }

  async getActiveTrip(userId: string): Promise<Trip | undefined> {
    const [trip] = await db
      .select()
      .from(trips)
      .where(and(eq(trips.userId, userId), eq(trips.isActive, true)))
      .limit(1);
    return trip;
  }

  async createTrip(tripData: InsertTrip): Promise<Trip> {
    const [trip] = await db
      .insert(trips)
      .values({
        id: randomUUID(),
        ...tripData,
        isActive: true,
        startedAt: new Date(),
      })
      .returning();
    return trip;
  }

  async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | undefined> {
    const [trip] = await db
      .update(trips)
      .set(updates)
      .where(eq(trips.id, id))
      .returning();
    return trip;
  }

  async endTrip(id: string, endLocation: string, distance: number, duration: number): Promise<Trip | undefined> {
    // Anti-cheat: Verify trip exists and is active before ending
    const [existingTrip] = await db
      .select()
      .from(trips)
      .where(and(eq(trips.id, id), eq(trips.isActive, true)))
      .limit(1);
    
    if (!existingTrip) {
      throw new Error("Trip not found or already ended");
    }
    
    // Anti-cheat: Verify duration matches elapsed time since start
    const elapsedSeconds = Math.floor((Date.now() - existingTrip.startedAt.getTime()) / 1000);
    if (duration > elapsedSeconds + 60) { // Allow 60s tolerance
      throw new Error(`Invalid duration: trip started ${elapsedSeconds}s ago but claimed ${duration}s`);
    }
    
    // Calculate XP: 1 XP per km
    const xpEarned = Math.floor(distance);
    
    const [trip] = await db
      .update(trips)
      .set({
        endLocation,
        distance,
        duration,
        xpEarned,
        isActive: false,
        endedAt: new Date(),
      })
      .where(eq(trips.id, id))
      .returning();

    if (trip) {
      // Update user's total XP and totalKm
      const user = await this.getUser(trip.userId);
      if (user) {
        const newTotalXp = user.xp + xpEarned;
        const newTotalKm = user.totalKm + distance;
        
        // Fix: Deterministic level calculation from total XP
        // Level 1: 0-99 XP, Level 2: 100-199 XP, etc
        const newLevel = Math.max(1, Math.floor(newTotalXp / 100) + 1);
        
        await this.updateUser(trip.userId, {
          xp: newTotalXp,
          totalKm: newTotalKm,
          level: newLevel,
        });
      }
    }

    return trip;
  }

  // ========================================
  // BADGE METHODS (Not implemented yet)
  // ========================================
  
  async getAllBadges(): Promise<Badge[]> {
    throw new Error("Badge persistence not implemented - migrate to DatabaseStorage");
  }

  async getBadge(id: string): Promise<Badge | undefined> {
    throw new Error("Badge persistence not implemented - migrate to DatabaseStorage");
  }

  async createBadge(badge: InsertBadge): Promise<Badge> {
    throw new Error("Badge persistence not implemented - migrate to DatabaseStorage");
  }

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    throw new Error("Badge persistence not implemented - migrate to DatabaseStorage");
  }

  async awardBadge(userId: string, badgeId: string): Promise<UserBadge> {
    throw new Error("Badge persistence not implemented - migrate to DatabaseStorage");
  }

  async checkAndAwardBadges(userId: string): Promise<UserBadge[]> {
    throw new Error("Badge persistence not implemented - migrate to DatabaseStorage");
  }

  // ========================================
  // REPORT METHODS (Not implemented yet)
  // ========================================
  
  async getReports(limit?: number): Promise<Report[]> {
    throw new Error("Report persistence not implemented - migrate to DatabaseStorage");
  }

  async getReportsByUser(userId: string): Promise<Report[]> {
    throw new Error("Report persistence not implemented - migrate to DatabaseStorage");
  }

  async getNearbyReports(latitude: number, longitude: number, radiusKm?: number): Promise<Report[]> {
    throw new Error("Report persistence not implemented - migrate to DatabaseStorage");
  }

  async createReport(report: InsertReport): Promise<Report> {
    throw new Error("Report persistence not implemented - migrate to DatabaseStorage");
  }

  async upvoteReport(reportId: string): Promise<Report | undefined> {
    throw new Error("Report persistence not implemented - migrate to DatabaseStorage");
  }

  async cleanupExpiredReports(): Promise<number> {
    throw new Error("Report persistence not implemented - migrate to DatabaseStorage");
  }

  // ========================================
  // SPEED CAMERA METHODS (Partially implemented)
  // ========================================
  
  async getSpeedCameras(): Promise<SpeedCamera[]> {
    return await db.select().from(speedCameras);
  }

  async getAllSpeedCameras(): Promise<SpeedCamera[]> {
    return await this.getSpeedCameras();
  }

  async getNearbySpeedCameras(latitude: number, longitude: number, radiusKm: number = 2, country?: string): Promise<SpeedCamera[]> {
    // Enforce max radius (architect-approved: ≤5km, default 2km)
    const maxRadius = 5;
    const actualRadius = Math.min(radiusKm, maxRadius);
    
    // SQL query with Haversine distance calculation
    // Formula: 6371 * acos(cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2) - radians(lon1)) + sin(radians(lat1)) * sin(radians(lat2)))
    const query = sql`
      SELECT *,
        (6371 * acos(
          cos(radians(${latitude})) * cos(radians(latitude)) * 
          cos(radians(longitude) - radians(${longitude})) + 
          sin(radians(${latitude})) * sin(radians(latitude))
        )) AS distance
      FROM ${speedCameras}
      WHERE is_active = true
      ${country ? sql`AND country = ${country}` : sql``}
      HAVING distance <= ${actualRadius}
      ORDER BY distance ASC
    `;
    
    const results = await db.execute(query);
    return results.rows as SpeedCamera[];
  }

  async createSpeedCamera(camera: InsertSpeedCamera): Promise<SpeedCamera> {
    const [result] = await db.insert(speedCameras).values(camera).returning();
    return result;
  }

  async batchImportSpeedCameras(cameras: InsertSpeedCamera[], chunkSize: number = 1000): Promise<number> {
    let count = 0;
    for (let i = 0; i < cameras.length; i += chunkSize) {
      const chunk = cameras.slice(i, i + chunkSize);
      await db.insert(speedCameras).values(chunk).onConflictDoNothing();
      count += chunk.length;
    }
    return count;
  }

  async verifyCameraLocation(cameraId: string, userId: string, isVerified: boolean): Promise<CameraVerification> {
    throw new Error("Camera verification not implemented - migrate to DatabaseStorage");
  }

  async getCameraVerifications(cameraId: string): Promise<CameraVerification[]> {
    throw new Error("Camera verification not implemented - migrate to DatabaseStorage");
  }

  async updateCameraStatus(cameraId: string): Promise<void> {
    throw new Error("Camera status update not implemented - migrate to DatabaseStorage");
  }

  async createCameraVerification(verification: InsertCameraVerification): Promise<{
    success: boolean;
    cameraDeleted: boolean;
    notFoundCount: number;
    confirmedCount: number;
    message?: string;
  }> {
    throw new Error("Camera verification not implemented - migrate to DatabaseStorage");
  }

  // ========================================
  // TRAFFIC CAMERA METHODS (Partially implemented)
  // ========================================
  
  async getTrafficCameras(): Promise<TrafficCamera[]> {
    return await db.select().from(trafficCameras);
  }

  async getAllTrafficCameras(): Promise<TrafficCamera[]> {
    return await this.getTrafficCameras();
  }

  async getTrafficCamerasByCountry(country: string): Promise<TrafficCamera[]> {
    throw new Error("Traffic camera country filter not implemented - migrate to DatabaseStorage");
  }

  async getNearbyTrafficCameras(latitude: number, longitude: number, radiusKm?: number, country?: string): Promise<TrafficCamera[]> {
    throw new Error("Nearby traffic camera search not implemented - migrate to DatabaseStorage");
  }

  async createTrafficCamera(camera: InsertTrafficCamera): Promise<TrafficCamera> {
    const [result] = await db.insert(trafficCameras).values(camera).returning();
    return result;
  }

  async batchImportTrafficCameras(cameras: InsertTrafficCamera[]): Promise<number> {
    const chunkSize = 1000;
    let count = 0;
    for (let i = 0; i < cameras.length; i += chunkSize) {
      const chunk = cameras.slice(i, i + chunkSize);
      await db.insert(trafficCameras).values(chunk).onConflictDoNothing();
      count += chunk.length;
    }
    return count;
  }

  // ========================================
  // TRUCK PARK METHODS (Not implemented yet)
  // ========================================
  
  async getAllTruckParks(): Promise<TruckPark[]> {
    throw new Error("Truck park persistence not implemented - migrate to DatabaseStorage");
  }

  async getNearbyTruckParks(latitude: number, longitude: number, radiusKm?: number): Promise<TruckPark[]> {
    throw new Error("Truck park persistence not implemented - migrate to DatabaseStorage");
  }

  async createTruckPark(park: InsertTruckPark): Promise<TruckPark> {
    throw new Error("Truck park persistence not implemented - migrate to DatabaseStorage");
  }

  async updateParkAvailability(parkId: string, spotsAvailable: number, userId: string, notes?: string): Promise<ParkUpdate> {
    throw new Error("Truck park persistence not implemented - migrate to DatabaseStorage");
  }

  async getParkUpdates(parkId: string, hoursAgo?: number): Promise<ParkUpdate[]> {
    throw new Error("Truck park persistence not implemented - migrate to DatabaseStorage");
  }

  // ========================================
  // USER PRESENCE METHODS (Not implemented yet)
  // ========================================
  
  async updateUserPresence(presence: InsertUserPresence): Promise<UserPresence> {
    throw new Error("User presence persistence not implemented - migrate to DatabaseStorage");
  }

  async getActiveUserPresences(olderThanMinutes?: number): Promise<UserPresence[]> {
    throw new Error("User presence persistence not implemented - migrate to DatabaseStorage");
  }

  async getNearbyUserPresences(latitude: number, longitude: number, radiusKm?: number): Promise<UserPresence[]> {
    throw new Error("User presence persistence not implemented - migrate to DatabaseStorage");
  }

  async cleanupStalePresences(olderThanMinutes: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    const result = await db
      .delete(userPresence)
      .where(sql`${userPresence.lastUpdated} < ${cutoffTime}`)
      .returning({ id: userPresence.userId });
    
    return result.length;
  }
}

export const storage = new DatabaseStorage();
