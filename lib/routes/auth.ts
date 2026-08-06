import { Router } from "express";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";

import { db } from "../db";
import { requireAuth } from "../services/requireAuth";

const router = Router();

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "DEV" | "GUEST";

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  user_role: UserRole;
  user_rank: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: number;
}

router.get("/test", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Auth route works.",
  });
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username-ul și parola sunt obligatorii.",
      });
    }

    const [users] = await db.execute<UserRow[]>(
      `
    SELECT
      u.id,
      u.username,
      u.password_hash,
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
    WHERE u.username = ?
    LIMIT 1
  `,
      [username.trim()],
    );

    const user = users[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Username sau parolă incorectă.",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Contul este dezactivat.",
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordIsValid) {
      return res.status(401).json({
        success: false,
        message: "Username sau parolă incorectă.",
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

    return res.status(200).json({
      success: true,
      message: "Autentificare reușită.",
      user: {
        id: user.id,
        username: user.username,
        role: user.user_role,
        rank: user.user_rank,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la autentificare.",
    });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        message: "Nu s-a putut închide sesiunea.",
      });
    }

    res.clearCookie("tgb-session");

    return res.json({
      message: "Logout successful.",
    });
  });
});

router.patch("/schimbare-parola", async (req, res) => {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu există o sesiune activă.",
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Toate câmpurile sunt obligatorii.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Parola nouă trebuie să aibă minimum 8 caractere.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Parolele noi nu coincid.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Parola nouă trebuie să fie diferită de parola actuală.",
      });
    }

    const [users] = await db.execute<UserRow[]>(
      `
        SELECT
          u.id,
          u.username,
          u.password_hash,
          ur.name AS user_role,
          NULL AS user_rank,
          u.is_active
        FROM users u
        INNER JOIN user_roles ur
          ON ur.id = u.user_role_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [sessionUser.id],
    );

    const user = users[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilizatorul nu a fost găsit.",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Contul este dezactivat.",
      });
    }

    const currentPasswordIsValid = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );

    if (!currentPasswordIsValid) {
      return res.status(401).json({
        success: false,
        message: "Parola actuală este incorectă.",
      });
    }

    const newPasswordMatchesOldPassword = await bcrypt.compare(
      newPassword,
      user.password_hash,
    );

    if (newPasswordMatchesOldPassword) {
      return res.status(400).json({
        success: false,
        message: "Parola nouă trebuie să fie diferită de parola actuală.",
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await db.execute(
      `
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
      `,
      [newPasswordHash, user.id],
    );

    return res.status(200).json({
      success: true,
      message: "Parola a fost schimbată cu succes.",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la schimbarea parolei.",
    });
  }
});

router.get("/me", requireAuth, (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: "Nu există o sesiune activă.",
    });
  }

  return res.status(200).json({
    success: true,
    user: req.session.user,
  });
});

export default router;
