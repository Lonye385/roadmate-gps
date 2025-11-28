import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { WebSocketServer, WebSocket } from 'ws';

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // COMMENTED OUT: Production build serving (causes ENOENT errors in dev mode)
  // MOBILE FIX: Serve production build for /app route (bypasses runtime-error-modal plugin)
  // Must be BEFORE setupVite to intercept mobile traffic
  // const path = await import('path');
  // const distPath = path.resolve(process.cwd(), 'dist/public');
  // 
  // // Serve static assets from production build
  // app.use('/assets', express.static(path.resolve(distPath, 'assets'), {
  //   setHeaders: (res) => {
  //     res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache assets for 1 year
  //   }
  // }));
  // 
  // // Serve /app route with production React build (MobileAppTest component)
  // app.get('/app', (_req, res) => {
  //   res.sendFile(path.resolve(distPath, 'index.html'));
  // });
  // 
  // // Serve /app-react route with production build index.html (for comparison)
  // app.get('/app-react', (_req, res) => {
  //   res.sendFile(path.resolve(distPath, 'index.html'));
  // });
  // 
  // log('📱 Mobile route /app → serving production build (no plugin overlay)');
  
  // Import TomTom Speed Camera Database (42K cameras)
  const { importTomTomCameras } = await import('./import-tomtom-cameras');
  await importTomTomCameras();
  
  // Import Spain Traffic Cameras (1,933 live cameras from DGT)
  const { importSpainTrafficCameras } = await import('./import-traffic-cameras');
  await importSpainTrafficCameras();

  // WebSocket server for anonymous user presence (Waze-style)
  // Use /ws path to avoid conflict with Vite HMR WebSocket
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  // Track user positions with 10-min privacy delay (QUEUE per user)
  interface UserPosition {
    userId: string;
    vehicleType: string;
    latitude: number;
    longitude: number;
    timestamp: number;
    invisible: boolean;
  }
  
  // Store QUEUE of positions per WebSocket (not single position!)
  const userPositionQueues = new Map<WebSocket, UserPosition[]>();
  
  wss.on('connection', (ws: WebSocket) => {
    log('WebSocket client connected');
    userPositionQueues.set(ws, []); // Initialize empty queue
    
    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'position_update') {
          const queue = userPositionQueues.get(ws) || [];
          
          // APPEND new position to queue
          queue.push({
            userId: message.userId || `anon-${Date.now()}`,
            vehicleType: message.vehicleType || 'car',
            latitude: message.latitude,
            longitude: message.longitude,
            timestamp: Date.now(),
            invisible: message.invisible || false
          });
          
          // Time-based cleanup: remove positions older than 15 minutes (after they've been broadcast)
          const now = Date.now();
          const RETENTION_MS = 15 * 60 * 1000; // 15 minutes
          const filtered = queue.filter(pos => now - pos.timestamp < RETENTION_MS);
          
          userPositionQueues.set(ws, filtered);
        }
      } catch (error) {
        log(`WebSocket message error: ${error}`);
      }
    });
    
    ws.on('close', () => {
      userPositionQueues.delete(ws);
      log('WebSocket client disconnected');
    });
  });
  
  // Broadcast delayed positions every 5 seconds
  const DELAY_MS = 10 * 60 * 1000; // 10 minutes
  setInterval(() => {
    const now = Date.now();
    const delayedPositions: Array<{
      vehicleType: string;
      latitude: number;
      longitude: number;
      timestamp: number;
    }> = [];
    
    // Deduplicate: collect LATEST position ≥10 min old per userId
    // This ensures ONE marker per user (not dozens!)
    const userLatestPositions = new Map<string, UserPosition>();
    
    userPositionQueues.forEach((queue) => {
      queue.forEach((position) => {
        if (!position.invisible && now - position.timestamp >= DELAY_MS) {
          const existing = userLatestPositions.get(position.userId);
          // Keep only LATEST position per userId
          if (!existing || position.timestamp > existing.timestamp) {
            userLatestPositions.set(position.userId, position);
          }
        }
      });
    });
    
    // Convert deduplicated map to broadcast array
    userLatestPositions.forEach((position) => {
      delayedPositions.push({
        vehicleType: position.vehicleType,
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: position.timestamp
      });
    });
    
    // Broadcast to all connected clients
    const message = JSON.stringify({
      type: 'user_positions',
      positions: delayedPositions
    });
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }, 5000);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
