import { Router } from "express";
import * as ranksDatabase from "../database/ranks";
import { requireAdmin } from "../services/requireAdmin";

const router = Router();

/**
 * GET /ranks/admin
 * Returnează toate rank-urile și numărul de utilizatori care le folosesc.
 */
router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const ranks = await ranksDatabase.getRanks();

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

    const exists = await ranksDatabase.rankExists(
      name,
      sortOrder,
    );

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Există deja un rank cu același nume sau cu aceeași ordine.",
      });
    }

    const rankId = await ranksDatabase.createRank({
      name,
      salary,
      salaryType,
      sortOrder,
    });

    return res.status(201).json({
      success: true,
      message: "Rank-ul a fost adăugat cu succes.",
      rank: {
        id: rankId,
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

    const exists = await ranksDatabase.rankExistsById(rankId);

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Rank-ul nu a fost găsit.",
      });
    }

    const duplicate = await ranksDatabase.rankNameOrSortOrderExists(
      rankId,
      name,
      sortOrder,
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "Există deja un alt rank cu același nume sau cu aceeași ordine.",
      });
    }

    await ranksDatabase.updateRank(rankId, {
      name,
      salary,
      salaryType,
      sortOrder,
    });

    const usersCount = await ranksDatabase.countUsersWithRank(rankId);

    return res.status(200).json({
      success: true,
      message: "Rank-ul a fost modificat cu succes.",
      rank: {
        id: rankId,
        name,
        salary,
        salary_type: salaryType,
        sort_order: sortOrder,
        users_count: usersCount,
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

    const exists = await ranksDatabase.rankExistsById(rankId);


    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Rank-ul nu a fost găsit.",
      });
    }

    const usersCount = await ranksDatabase.countUsersWithRank(rankId);

    if (usersCount > 0) {
      return res.status(409).json({
        success: false,
        message:
          usersCount === 1
            ? "Rank-ul nu poate fi șters deoarece este atribuit unui utilizator."
            : `Rank-ul nu poate fi șters deoarece este atribuit unui număr de ${usersCount} utilizatori.`,
      });
    }

    await ranksDatabase.deleteRank(rankId);

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
