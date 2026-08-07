import type { NextFunction, Request, Response } from "express";
import * as authDatabase from "../database/auth";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu există o sesiune activă.",
      });
    }

    const user = await authDatabase.findById(sessionUser.id);

    if (!user) {
      req.session.destroy(() => undefined);

      return res.status(401).json({
        success: false,
        message: "Utilizatorul nu mai există.",
      });
    }

    if (!user.is_active) {
      req.session.destroy(() => undefined);

      return res.status(403).json({
        success: false,
        message: "Contul este dezactivat.",
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.user_role,
      rank: user.user_rank,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    return next();
  } catch (error) {
    console.error("Require auth error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la verificarea sesiunii.",
    });
  }
}
