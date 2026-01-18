import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
const REPS_EMAILS = (process.env.REPS_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());

export interface UserPayload {
  email: string;
  name: string;
  picture: string | null;
  role: "admin" | "rep";
}

export function createToken(user: UserPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

export function getUserRole(email: string): "admin" | "rep" | null {
  const normalizedEmail = email.toLowerCase();
  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    return "admin";
  }
  if (REPS_EMAILS.includes(normalizedEmail)) {
    return "rep";
  }
  return null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.auth_token || req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  (req as any).user = user;
  next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as UserPayload;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
