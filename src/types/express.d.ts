import "express";

declare module "express-serve-static-core" {
  interface Request {
    auth?: { id: number; role: "customer" | "provider" | "admin"; sid: string };
  }
}
