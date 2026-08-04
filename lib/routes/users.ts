import { Router } from "express";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../db";
import { requireAdmin } from "../services/requireAdmin";

const router = Router();

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA";

interface ExistingUserRow extends RowDataPacket {
  id: number;
}

const allowedRoles: UserRole[] = ["ADMIN", "ANGAJAT", "MAFIA"];

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

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Parola trebuie să conțină minimum 8 caractere.",
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
