import { Router } from "express";
import bcrypt from "bcryptjs";
import * as authDatabase from "../database/auth";
import { requireAuth } from "../services/requireAuth";
import rateLimit from "express-rate-limit";

const router = Router();


router.get("/test", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Auth route works.",
  });
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

router.post("/login", loginRateLimit, async (req, res) => {
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

    const user = await authDatabase.findByUsername(username.trim());

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

const passwordChangeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password change attempts. Please try again later.",
  },
});

router.patch("/schimbare-parola", passwordChangeRateLimit, async (req, res) => {
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

    const user = await authDatabase.findById(sessionUser.id);

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

    await authDatabase.updatePassword(user.id, newPasswordHash);

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
