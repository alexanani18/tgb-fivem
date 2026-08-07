import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../db";
import { requireAdmin } from "../services/requireAdmin";

const router = Router();

type SalaryType = "PUBLIC" | "CONFIDENTIAL";

interface RankRow extends RowDataPacket {
  id: number;
  name: string;
  salary: number;
  salary_type: SalaryType;
  sort_order: number;
  users_count: number | string;
}

interface CountRow extends RowDataPacket {
  users_count: number | string;
}

interface ExistingRankRow extends RowDataPacket {
  id: number;
}

/**
 * GET /ranks/admin
 * Returnează toate rank-urile și numărul de utilizatori care le folosesc.
 */
router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const [rows] = await db.query<RankRow[]>(`
      SELECT
        ur.id,
        ur.name,
        ur.salary,
        ur.salary_type,
        ur.sort_order,
        COUNT(u.id) AS users_count
      FROM user_ranks ur
      LEFT JOIN users u ON u.user_rank_id = ur.id
      GROUP BY
        ur.id,
        ur.name,
        ur.salary,
        ur.salary_type,
        ur.sort_order
      ORDER BY
        ur.sort_order ASC,
        ur.name ASC
    `);

    const ranks = rows.map((rank) => ({
      id: Number(rank.id),
      name: rank.name,
      salary: Number(rank.salary),
      salary_type: rank.salary_type,
      sort_order: Number(rank.sort_order),
      users_count: Number(rank.users_count),
    }));

    return res.status(200).json({
      success: true,
      ranks,
    });
  } catch (error) {
    console.error("Eroare la încărcarea rank-urilor:", error);

    return res.status(500).json({
      success: false,
      message: "A apărut o eroare la încărcarea rank-urilor.",
    });
  }
});

/**
 * POST /ranks/admin
 * Creează un rank nou.
 */
router.post("/admin", requireAdmin, async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

    const salaryType =
      req.body.salary_type === "CONFIDENTIAL" ? "CONFIDENTIAL" : "PUBLIC";

    const salary = salaryType === "CONFIDENTIAL" ? 0 : Number(req.body.salary);

    const sortOrder = Number(req.body.sort_order);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Numele rank-ului este obligatoriu.",
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Numele rank-ului poate avea maximum 100 de caractere.",
      });
    }

    if (salaryType === "PUBLIC" && (!Number.isInteger(salary) || salary <= 0)) {
      return res.status(400).json({
        success: false,
        message:
          "Pentru un salariu public, valoarea trebuie să fie un număr întreg mai mare decât 0.",
      });
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      return res.status(400).json({
        success: false,
        message: "Ordinea trebuie să fie un număr întreg mai mare decât 0.",
      });
    }

    const [existingRows] = await db.query<ExistingRankRow[]>(
      `
        SELECT id
        FROM user_ranks
        WHERE LOWER(name) = LOWER(?)
           OR sort_order = ?
        LIMIT 1
      `,
      [name, sortOrder],
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Există deja un rank cu același nume sau cu aceeași ordine.",
      });
    }

    const [result] = await db.execute<ResultSetHeader>(
      `
        INSERT INTO user_ranks (
          name,
          salary,
          salary_type,
          sort_order
        )
        VALUES (?, ?, ?, ?)
      `,
      [name, salary, salaryType, sortOrder],
    );

    return res.status(201).json({
      success: true,
      message: "Rank-ul a fost adăugat cu succes.",
      rank: {
        id: result.insertId,
        name,
        salary,
        salary_type: salaryType,
        sort_order: sortOrder,
        users_count: 0,
      },
    });
  } catch (error) {
    console.error("Eroare la adăugarea rank-ului:", error);

    return res.status(500).json({
      success: false,
      message: "A apărut o eroare la adăugarea rank-ului.",
    });
  }
});

/**
 * PATCH /ranks/admin/:rankId
 * Modifică un rank existent.
 */
router.patch("/admin/:rankId", requireAdmin, async (req, res) => {
  try {
    const rankId = Number(req.params.rankId);

    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";

    const salaryType =
      req.body.salary_type === "CONFIDENTIAL" ? "CONFIDENTIAL" : "PUBLIC";

    const salary = salaryType === "CONFIDENTIAL" ? 0 : Number(req.body.salary);

    const sortOrder = Number(req.body.sort_order);

    if (!Number.isInteger(rankId) || rankId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul rank-ului nu este valid.",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Numele rank-ului este obligatoriu.",
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Numele rank-ului poate avea maximum 100 de caractere.",
      });
    }

    if (salaryType === "PUBLIC" && (!Number.isInteger(salary) || salary <= 0)) {
      return res.status(400).json({
        success: false,
        message:
          "Pentru un salariu public, valoarea trebuie să fie un număr întreg mai mare decât 0.",
      });
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 1) {
      return res.status(400).json({
        success: false,
        message: "Ordinea trebuie să fie un număr întreg mai mare decât 0.",
      });
    }

    const [rankRows] = await db.query<ExistingRankRow[]>(
      `
        SELECT id
        FROM user_ranks
        WHERE id = ?
        LIMIT 1
      `,
      [rankId],
    );

    if (rankRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rank-ul nu a fost găsit.",
      });
    }

    const [duplicateRows] = await db.query<ExistingRankRow[]>(
      `
        SELECT id
        FROM user_ranks
        WHERE id <> ?
          AND (
            LOWER(name) = LOWER(?)
            OR sort_order = ?
          )
        LIMIT 1
      `,
      [rankId, name, sortOrder],
    );

    if (duplicateRows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Există deja un alt rank cu același nume sau cu aceeași ordine.",
      });
    }

    await db.execute<ResultSetHeader>(
      `
        UPDATE user_ranks
        SET
          name = ?,
          salary = ?,
          salary_type = ?,
          sort_order = ?
        WHERE id = ?
      `,
      [name, salary, salaryType, sortOrder, rankId],
    );

    const [countRows] = await db.query<CountRow[]>(
      `
        SELECT COUNT(*) AS users_count
        FROM users
        WHERE user_rank_id = ?
      `,
      [rankId],
    );

    return res.status(200).json({
      success: true,
      message: "Rank-ul a fost modificat cu succes.",
      rank: {
        id: rankId,
        name,
        salary,
        salary_type: salaryType,
        sort_order: sortOrder,
        users_count: Number(countRows[0]?.users_count ?? 0),
      },
    });
  } catch (error) {
    console.error("Eroare la modificarea rank-ului:", error);

    return res.status(500).json({
      success: false,
      message: "A apărut o eroare la modificarea rank-ului.",
    });
  }
});

/**
 * DELETE /ranks/admin/:rankId
 * Șterge un rank doar dacă nu este atribuit niciunui utilizator.
 */
router.delete("/admin/:rankId", requireAdmin, async (req, res) => {
  try {
    const rankId = Number(req.params.rankId);

    if (!Number.isInteger(rankId) || rankId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul rank-ului nu este valid.",
      });
    }

    const [rankRows] = await db.query<ExistingRankRow[]>(
      `
        SELECT id
        FROM user_ranks
        WHERE id = ?
        LIMIT 1
      `,
      [rankId],
    );

    if (rankRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rank-ul nu a fost găsit.",
      });
    }

    const [countRows] = await db.query<CountRow[]>(
      `
        SELECT COUNT(*) AS users_count
        FROM users
        WHERE user_rank_id = ?
      `,
      [rankId],
    );

    const usersCount = Number(countRows[0]?.users_count ?? 0);

    if (usersCount > 0) {
      return res.status(409).json({
        success: false,
        message:
          usersCount === 1
            ? "Rank-ul nu poate fi șters deoarece este atribuit unui utilizator."
            : `Rank-ul nu poate fi șters deoarece este atribuit unui număr de ${usersCount} utilizatori.`,
      });
    }

    await db.execute<ResultSetHeader>(
      `
        DELETE FROM user_ranks
        WHERE id = ?
      `,
      [rankId],
    );

    return res.status(200).json({
      success: true,
      message: "Rank-ul a fost șters cu succes.",
    });
  } catch (error) {
    console.error("Eroare la ștergerea rank-ului:", error);

    return res.status(500).json({
      success: false,
      message: "A apărut o eroare la ștergerea rank-ului.",
    });
  }
});

export default router;
