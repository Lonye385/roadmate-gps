import { createHmac } from "crypto";

const SECRET = process.env.SESSION_SECRET || "roadmate-dev-secret-change-in-production";

// Simple signed token system for MVP (not JWT, just HMAC signature)
export function createUserToken(userId: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const signature = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

export function verifyUserToken(token: string): string | null {
  try {
    const [userId, timestamp, signature] = token.split(':');
    if (!userId || !timestamp || !signature) {
      return null;
    }
    
    // Verify signature
    const payload = `${userId}:${timestamp}`;
    const expectedSignature = createHmac('sha256', SECRET).update(payload).digest('hex');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Token is valid for 30 days
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    if (tokenAge > maxAge) {
      return null;
    }
    
    return userId;
  } catch {
    return null;
  }
}
