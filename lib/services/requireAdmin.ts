import type { NextFunction, Request, Response } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Trebuie să fii autentificat.",
    });
  }

  if (req.session.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Doar administratorii pot efectua această acțiune.",
    });
  }

  next();
}
