import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./requireAuth";

export async function requireEmployee(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  await requireAuth(req, res, () => {
    if (req.session.user?.role === "GUEST") {
      return res.status(403).json({
        success: false,
        message: "Nu ai permisiunea să accesezi această pagină.",
      });
    }

    next();
  });
}