import type { NextFunction, Request, Response } from "express";
import type { RowDataPacket } from "mysql2";

import { db } from "../db";

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "GUEST" | "DEV";

interface ActiveUserRow extends RowDataPacket {
  id: number;
  username: string;
  user_role: UserRole;
  user_rank: string | null;
  first_name: string | null;
  last_name: string | null;
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
          u.id,
          u.username,
          ur.name AS user_role,
          usr.name AS user_rank,
          ec.first_name,
          ec.last_name,
          u.is_active
        FROM users u
        INNER JOIN user_roles ur
          ON ur.id = u.user_role_id
        LEFT JOIN user_ranks usr
          ON usr.id = u.user_rank_id
        LEFT JOIN employee_contracts ec
          ON ec.id = (
            SELECT ec2.id
            FROM employee_contracts ec2
            WHERE ec2.user_id = u.id
            ORDER BY
              CASE
                WHEN ec2.status = 'APPROVED' THEN 0
                WHEN ec2.status = 'PENDING_REVIEW' THEN 1
                WHEN ec2.status = 'DRAFT' THEN 2
                ELSE 3
              END,
              ec2.updated_at DESC,
              ec2.id DESC
            LIMIT 1
          )
        WHERE u.id = ?
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
