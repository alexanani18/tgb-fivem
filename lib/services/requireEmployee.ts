import type { NextFunction, Request, Response } from "express";

export function requireEmployee(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Trebuie să fii autentificat.",
    });
  }

  if (req.session.user.role === "GUEST") {
    return res.status(403).json({
      success: false,
      message: "Nu ai permisiunea să accesezi această pagină.",
    });
  }

  next();
}