import { Request, Response, NextFunction } from "express";
import { verifyUserToken } from "./auth-utils";

// Simple auth middleware - verifies signed token from Authorization header
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "No token provided" });
  }
  
  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const userId = verifyUserToken(token);
  
  if (!userId) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  
  // Attach userId to request for downstream handlers
  (req as any).userId = userId;
  next();
}

// Optional auth - doesn't require token but extracts userId if present
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const userId = verifyUserToken(token);
    if (userId) {
      (req as any).userId = userId;
    }
  }
  
  next();
}
