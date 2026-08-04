import type { NextFunction, Request, Response } from "express";
import type { RowDataPacket } from "mysql2";

import { db } from "../db";

interface ActiveUserRow extends RowDataPacket {
  id: number;
  username: string;
  user_role: "ADMIN" | "ANGAJAT" | "MAFIA" | "GUEST" | "DEV";
  is_active: number;
}

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

    const [users] = await db.execute<ActiveUserRow[]>(
      `
        SELECT
          id,
          username,
          user_role,
          is_active
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [sessionUser.id],
    );

    const user = users[0];

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
