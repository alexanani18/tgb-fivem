import { Router } from "express";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../db";
import { requireAdmin } from "../services/requireAdmin";

const router = Router();

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "GUEST" | "DEV";

interface ExistingUserRow extends RowDataPacket {
  id: number;
}
interface UserListRow extends RowDataPacket {
  id: number;
  username: string;
  user_role: UserRole;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

const allowedRoles: UserRole[] = ["GUEST", "ADMIN", "ANGAJAT", "MAFIA", "DEV"];

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const [users] = await db.execute<UserListRow[]>(
      `
        SELECT
          id,
          username,
          user_role,
          is_active,
          created_at,
          updated_at
        FROM users
        ORDER BY
          CASE user_role
            WHEN 'GUEST' THEN 0
            WHEN 'ANGAJAT' THEN 1
            WHEN 'MAFIA' THEN 2
            WHEN 'ADMIN' THEN 3
            ELSE 4
          END,
        username ASC
      `,
    );

    return res.status(200).json({
      success: true,
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.user_role,
        isActive: Boolean(user.is_active),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })),
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la încărcarea utilizatorilor.",
    });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Username-ul, parola și rolul sunt obligatorii.",
      });
    }

    const normalizedUsername = username.trim();
    const normalizedRole = role.trim().toUpperCase() as UserRole;

    if (normalizedUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username-ul trebuie să conțină minimum 3 caractere.",
      });
    }

    if (normalizedUsername.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Username-ul poate avea maximum 100 de caractere.",
      });
    }

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Rolul selectat nu este valid.",
      });
    }

    const [existingUsers] = await db.execute<ExistingUserRow[]>(
      `
        SELECT id
        FROM users
        WHERE username = ?
        LIMIT 1
      `,
      [normalizedUsername],
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Există deja un utilizator cu acest username.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute<ResultSetHeader>(
      `
        INSERT INTO users (
          username,
          password_hash,
          user_role,
          is_active
        )
        VALUES (?, ?, ?, 1)
      `,
      [normalizedUsername, passwordHash, normalizedRole],
    );

    return res.status(201).json({
      success: true,
      message: "Utilizatorul a fost creat cu succes.",
      user: {
        id: result.insertId,
        username: normalizedUsername,
        role: normalizedRole,
        isActive: true,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la crearea utilizatorului.",
    });
  }
});

export default router;
