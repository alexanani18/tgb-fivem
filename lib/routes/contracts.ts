import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../db";
import { requireAuth } from "../services/requireAuth";
import { requireAdmin } from "../services/requireAdmin";
import { generateEmployeeContract } from "../services/contractGenerationService";

const router = Router();

const MAX_IDENTITY_IMAGE_SIZE = 5 * 1024 * 1024;

const allowedIdentityImageTypes = ["image/jpeg", "image/png"] as const;

const identityImageStorage = multer.diskStorage({
  destination: (req, _file, callback) => {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return callback(new Error("Nu există o sesiune activă."), "");
    }

    const userDirectory = path.join(
      process.cwd(),
      "public",
      "contract-images",
      String(sessionUser.id),
    );

    fs.mkdirSync(userDirectory, {
      recursive: true,
    });

    return callback(null, userDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const fileName = `identity-${Date.now()}${extension}`;

    return callback(null, fileName);
  },
});

const identityImageUpload = multer({
  storage: identityImageStorage,

  limits: {
    fileSize: MAX_IDENTITY_IMAGE_SIZE,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    const isAllowedType = allowedIdentityImageTypes.includes(
      file.mimetype as (typeof allowedIdentityImageTypes)[number],
    );

    if (!isAllowedType) {
      return callback(
        new Error("Poza buletinului trebuie să fie în format JPG sau PNG."),
      );
    }

    return callback(null, true);
  },
});

function deleteUploadedFile(filePath?: string): void {
  if (!filePath) {
    return;
  }

  fs.unlink(filePath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Delete uploaded contract image error:", error);
    }
  });
}

type ContractStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED";

interface ContractRow extends RowDataPacket {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  age: number;
  game_id: string;
  ci_series: string;
  phone_number: string;
  city_hours: number;
  identity_image_path: string;
  accepted_rules: number;
  employee_signature_name: string | null;
  status: ContractStatus;
  contract_creation_blocked: number;
  signed_at: Date | null;
  approved_by_user_id: number | null;
  approved_by_name: string | null;
  admin_signature_path: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  rejected_by_user_id: number | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
}

interface AdminContractListRow extends RowDataPacket {
  id: number;
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  age: number;
  game_id: string;
  ci_series: string;
  phone_number: string;
  city_hours: number;
  identity_image_path: string;
  accepted_rules: number;
  employee_signature_name: string | null;
  status: ContractStatus;
  contract_creation_blocked: number;
  signed_at: Date | null;
  approved_by_user_id: number | null;
  approved_by_name: string | null;
  admin_signature_path: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  rejected_by_user_id: number | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
}

interface GeneratedContractRow extends RowDataPacket {
  document_number: string;
  current_version: number;
  png_path: string;
  pdf_path: string;
  generated_at: Date;
}

router.get("/me", requireAuth, async (req, res) => {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu există o sesiune activă.",
      });
    }

    const [contracts] = await db.execute<ContractRow[]>(
      `
        SELECT
          ec.id,
          ec.user_id,
          ec.first_name,
          ec.last_name,
          ec.age,
          ec.game_id,
          ec.ci_series,
          ec.phone_number,
          ec.city_hours,
          ec.identity_image_path,
          ec.accepted_rules,
          ec.employee_signature_name,
          ec.status,
          ec.contract_creation_blocked,
          ec.signed_at,
          ec.approved_by_user_id,
          ec.approved_by_name,
          ec.admin_signature_path,
          ec.approved_at,
          ec.rejected_by_user_id,
          rejected_user.username AS rejected_by_name,
          ec.rejected_at,
          ec.created_at,
          ec.updated_at
        FROM employee_contracts ec
        LEFT JOIN users rejected_user
          ON rejected_user.id = ec.rejected_by_user_id
        WHERE ec.user_id = ?
        LIMIT 1
      `,
      [sessionUser.id],
    );

    const contract = contracts[0];

    if (!contract) {
      return res.status(200).json({
        success: true,
        contract: null,
        canCreateContract: sessionUser.role === "GUEST",
      });
    }

    return res.status(200).json({
      success: true,
      contract: {
        id: contract.id,
        userId: contract.user_id,
        firstName: contract.first_name,
        lastName: contract.last_name,
        age: contract.age,
        gameId: contract.game_id,
        ciSeries: contract.ci_series,
        phoneNumber: contract.phone_number,
        cityHours: contract.city_hours,
        identityImagePath: contract.identity_image_path,
        acceptedRules: Boolean(contract.accepted_rules),
        employeeSignatureName: contract.employee_signature_name,
        status: contract.status,
        contractCreationBlocked: Boolean(contract.contract_creation_blocked),
        signedAt: contract.signed_at,
        approvedByUserId: contract.approved_by_user_id,
        approvedByName: contract.approved_by_name,
        adminSignaturePath: contract.admin_signature_path,
        approvedAt: contract.approved_at,
        rejectedByUserId: contract.rejected_by_user_id,
        rejectedByName: contract.rejected_by_name,
        rejectedAt: contract.rejected_at,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
      },

      // Dacă există deja un contract, nu poate crea altul.
      canCreateContract: false,
    });
  } catch (error) {
    console.error("Get own contract error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la încărcarea contractului.",
    });
  }
});

router.get("/me/document", async (req, res) => {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu ești autentificat.",
      });
    }

    const [rows] = await db.query<GeneratedContractRow[]>(
      `
        SELECT
          ed.document_number,
          ed.current_version,
          edv.png_path,
          edv.pdf_path,
          edv.generated_at
        FROM employee_documents ed
        INNER JOIN employee_document_versions edv
          ON edv.document_id = ed.id
          AND edv.version_number = ed.current_version
        INNER JOIN employee_contracts ec
          ON ec.id = ed.contract_id
        WHERE ec.user_id = ?
          AND ec.status = 'APPROVED'
        LIMIT 1
      `,
      [sessionUser.id],
    );

    const document = rows[0];

    if (!document) {
      return res.status(200).json({
        success: true,
        document: null,
      });
    }

    return res.status(200).json({
      success: true,
      document: {
        documentNumber: document.document_number,
        currentVersion: document.current_version,
        pngPath: document.png_path,
        pdfPath: document.pdf_path,
        generatedAt: document.generated_at,
      },
    });
  } catch (error) {
    console.error("Get employee document error:", error);

    return res.status(500).json({
      success: false,
      message: "Documentul contractului nu a putut fi încărcat.",
    });
  }
});

router.post(
  "/sign",
  requireAuth,
  identityImageUpload.single("identityImage"),
  async (req, res) => {
    const sessionUser = req.session.user;
    const uploadedFilePath = req.file?.path;

    if (!sessionUser) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(401).json({
        success: false,
        message: "Nu există o sesiune activă.",
      });
    }

    if (sessionUser.role !== "GUEST") {
      deleteUploadedFile(uploadedFilePath);

      return res.status(403).json({
        success: false,
        message: "Doar utilizatorii GUEST pot semna un contract nou.",
      });
    }

    const {
      firstName,
      lastName,
      age,
      gameId,
      ciSeries,
      phoneNumber,
      cityHours,
      acceptedRules,
    } = req.body;

    /*
     * În formular:
     * lastName = Nume
     * firstName = Prenume
     */

    const normalizedFirstName =
      typeof firstName === "string" ? firstName.trim() : "";

    const normalizedLastName =
      typeof lastName === "string" ? lastName.trim() : "";

    const normalizedGameId = typeof gameId === "string" ? gameId.trim() : "";

    const normalizedCiSeries =
      typeof ciSeries === "string" ? ciSeries.trim().toUpperCase() : "";

    const normalizedPhoneNumber =
      typeof phoneNumber === "string" ? phoneNumber.trim() : "";

    const normalizedAge =
      typeof age === "string" || typeof age === "number"
        ? Number(age)
        : Number.NaN;

    const normalizedCityHours =
      typeof cityHours === "string" || typeof cityHours === "number"
        ? Number(cityHours)
        : Number.NaN;

    const rulesWereAccepted =
      acceptedRules === true ||
      acceptedRules === "true" ||
      acceptedRules === "1" ||
      acceptedRules === "on";

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedGameId ||
      !normalizedCiSeries ||
      !normalizedPhoneNumber ||
      !Number.isInteger(normalizedAge) ||
      !Number.isInteger(normalizedCityHours) ||
      !rulesWereAccepted ||
      !req.file
    ) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message:
          "Toate datele contractului, acceptarea regulamentului și poza buletinului sunt obligatorii.",
      });
    }

    if (normalizedFirstName.length < 2 || normalizedFirstName.length > 100) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "Prenumele trebuie să conțină între 2 și 100 de caractere.",
      });
    }

    if (normalizedLastName.length < 2 || normalizedLastName.length > 100) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "Numele trebuie să conțină între 2 și 100 de caractere.",
      });
    }

    if (normalizedAge < 1 || normalizedAge > 100) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "Vârsta introdusă nu este validă.",
      });
    }

    if (normalizedGameId.length > 50) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "ID-ul din joc poate avea maximum 50 de caractere.",
      });
    }

    if (normalizedCiSeries.length < 2 || normalizedCiSeries.length > 50) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "Seria CI trebuie să conțină între 2 și 50 de caractere.",
      });
    }

    if (normalizedPhoneNumber.length < 3 || normalizedPhoneNumber.length > 30) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "Numărul de telefon introdus nu este valid.",
      });
    }

    if (normalizedCityHours < 0 || normalizedCityHours > 100000) {
      deleteUploadedFile(uploadedFilePath);

      return res.status(400).json({
        success: false,
        message: "Numărul de luni/ore pe oraș nu este valid.",
      });
    }

    const identityImagePath = `/contract-images/${sessionUser.id}/${req.file.filename}`;

    const employeeSignatureName = `${normalizedLastName} ${normalizedFirstName}`;

    const connection = await db.getConnection();

    let previousIdentityImagePath: string | null = null;

    try {
      await connection.beginTransaction();

      interface ExistingContractRow extends RowDataPacket {
        id: number;
        status: ContractStatus;
        identity_image_path: string;
        contract_creation_blocked: number;
      }

      const [existingContracts] = await connection.execute<
        ExistingContractRow[]
      >(
        `
            SELECT
              id,
              status,
              identity_image_path,
              contract_creation_blocked
            FROM employee_contracts
            WHERE user_id = ?
            LIMIT 1
            FOR UPDATE
          `,
        [sessionUser.id],
      );

      const existingContract = existingContracts[0];

      if (existingContract?.contract_creation_blocked) {
        await connection.rollback();
        deleteUploadedFile(uploadedFilePath);

        return res.status(403).json({
          success: false,
          message:
            "Crearea unui contract nou a fost blocată pentru acest utilizator.",
        });
      }

      if (
        existingContract &&
        ["PENDING_REVIEW", "APPROVED", "BLOCKED"].includes(
          existingContract.status,
        )
      ) {
        await connection.rollback();
        deleteUploadedFile(uploadedFilePath);

        const message =
          existingContract.status === "PENDING_REVIEW"
            ? "Contractul tău este deja în verificare."
            : existingContract.status === "APPROVED"
              ? "Contractul tău a fost deja aprobat."
              : "Nu mai poți crea sau trimite un contract.";

        return res.status(409).json({
          success: false,
          message,
        });
      }

      if (existingContract) {
        previousIdentityImagePath = existingContract.identity_image_path;

        await connection.execute<ResultSetHeader>(
          `
            UPDATE employee_contracts
            SET
              first_name = ?,
              last_name = ?,
              age = ?,
              game_id = ?,
              ci_series = ?,
              phone_number = ?,
              city_hours = ?,
              identity_image_path = ?,
              accepted_rules = 1,
              employee_signature_name = ?,
              status = 'PENDING_REVIEW',
              signed_at = CURRENT_TIMESTAMP,
              approved_by_user_id = NULL,
              approved_by_name = NULL,
              admin_signature_path = NULL,
              approved_at = NULL,
              rejected_at = NULL
            WHERE id = ?
          `,
          [
            normalizedFirstName,
            normalizedLastName,
            normalizedAge,
            normalizedGameId,
            normalizedCiSeries,
            normalizedPhoneNumber,
            normalizedCityHours,
            identityImagePath,
            employeeSignatureName,
            existingContract.id,
          ],
        );
      } else {
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO employee_contracts (
              user_id,
              first_name,
              last_name,
              age,
              game_id,
              ci_series,
              phone_number,
              city_hours,
              identity_image_path,
              accepted_rules,
              employee_signature_name,
              status,
              signed_at
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              1,
              ?,
              'PENDING_REVIEW',
              CURRENT_TIMESTAMP
            )
          `,
          [
            sessionUser.id,
            normalizedFirstName,
            normalizedLastName,
            normalizedAge,
            normalizedGameId,
            normalizedCiSeries,
            normalizedPhoneNumber,
            normalizedCityHours,
            identityImagePath,
            employeeSignatureName,
          ],
        );
      }

      await connection.commit();

      if (previousIdentityImagePath) {
        const absolutePreviousImagePath = path.join(
          process.cwd(),
          "public",
          previousIdentityImagePath.replace(/^\/+/, ""),
        );

        deleteUploadedFile(absolutePreviousImagePath);
      }

      return res.status(201).json({
        success: true,
        message:
          "Contractul a fost semnat și trimis către ADMIN pentru verificare.",
        contract: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          age: normalizedAge,
          gameId: normalizedGameId,
          ciSeries: normalizedCiSeries,
          phoneNumber: normalizedPhoneNumber,
          cityHours: normalizedCityHours,
          identityImagePath,
          acceptedRules: true,
          employeeSignatureName,
          status: "PENDING_REVIEW",
        },
      });
    } catch (error) {
      await connection.rollback();
      deleteUploadedFile(uploadedFilePath);

      console.error("Sign contract error:", error);

      return res.status(500).json({
        success: false,
        message: "Eroare internă la semnarea contractului.",
      });
    } finally {
      connection.release();
    }
  },
);

router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const [contracts] = await db.execute<AdminContractListRow[]>(
      `
        SELECT
          ec.id,
          ec.user_id,
          u.username,
          ec.first_name,
          ec.last_name,
          ec.age,
          ec.game_id,
          ec.ci_series,
          ec.phone_number,
          ec.city_hours,
          ec.identity_image_path,
          ec.accepted_rules,
          ec.employee_signature_name,
          ec.status,
          ec.contract_creation_blocked,
          ec.signed_at,
          ec.approved_by_user_id,
          ec.approved_by_name,
          ec.admin_signature_path,
          ec.approved_at,
          ec.rejected_at,
          ec.created_at,
          ec.updated_at
        FROM employee_contracts ec
        INNER JOIN users u
          ON u.id = ec.user_id
        ORDER BY
          CASE ec.status
            WHEN 'PENDING_REVIEW' THEN 0
            WHEN 'REJECTED' THEN 1
            WHEN 'APPROVED' THEN 2
            WHEN 'BLOCKED' THEN 3
            ELSE 4
          END,
          ec.signed_at DESC,
          ec.created_at DESC
      `,
    );

    return res.status(200).json({
      success: true,
      contracts: contracts.map((contract) => ({
        id: contract.id,
        userId: contract.user_id,
        username: contract.username,
        firstName: contract.first_name,
        lastName: contract.last_name,
        age: contract.age,
        gameId: contract.game_id,
        ciSeries: contract.ci_series,
        phoneNumber: contract.phone_number,
        cityHours: contract.city_hours,
        identityImagePath: contract.identity_image_path,
        acceptedRules: Boolean(contract.accepted_rules),
        employeeSignatureName: contract.employee_signature_name,
        status: contract.status,
        contractCreationBlocked: Boolean(contract.contract_creation_blocked),
        signedAt: contract.signed_at,
        approvedByUserId: contract.approved_by_user_id,
        approvedByName: contract.approved_by_name,
        adminSignaturePath: contract.admin_signature_path,
        approvedAt: contract.approved_at,
        rejectedAt: contract.rejected_at,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
      })),
    });
  } catch (error) {
    console.error("Get admin contracts error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la încărcarea contractelor.",
    });
  }
});

router.post("/admin/:contractId/generate", requireAdmin, async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);
    const sessionUser = req.session.user;

    if (!Number.isInteger(contractId) || contractId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul contractului nu este valid.",
      });
    }

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu ești autentificat.",
      });
    }

    const result = await generateEmployeeContract(contractId, sessionUser.id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Generate contract error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Contractul nu a putut fi generat.";

    return res.status(500).json({
      success: false,
      message,
    });
  }
});

router.get("/admin/pending-count", requireAdmin, async (_req, res) => {
  try {
    interface PendingContractsCountRow extends RowDataPacket {
      pending_count: number;
    }

    const [rows] = await db.execute<PendingContractsCountRow[]>(
      `
        SELECT COUNT(*) AS pending_count
        FROM employee_contracts
        WHERE status = 'PENDING_REVIEW'
      `,
    );

    return res.status(200).json({
      success: true,
      pendingCount: Number(rows[0]?.pending_count ?? 0),
    });
  } catch (error) {
    console.error("Get pending contracts count error:", error);

    return res.status(500).json({
      success: false,
      message:
        "Eroare internă la încărcarea numărului contractelor în așteptare.",
    });
  }
});

router.get("/admin/:contractId", requireAdmin, async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);

    if (!Number.isInteger(contractId) || contractId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul contractului nu este valid.",
      });
    }

    const [contracts] = await db.execute<AdminContractListRow[]>(
      `
        SELECT
          ec.id,
          ec.user_id,
          u.username,
          ec.first_name,
          ec.last_name,
          ec.age,
          ec.game_id,
          ec.ci_series,
          ec.phone_number,
          ec.city_hours,
          ec.identity_image_path,
          ec.accepted_rules,
          ec.employee_signature_name,
          ec.status,
          ec.contract_creation_blocked,
          ec.signed_at,
          ec.approved_by_user_id,
          ec.approved_by_name,
          ec.admin_signature_path,
          ec.approved_at,
          ec.rejected_by_user_id,
          rejected_user.username AS rejected_by_name,
          ec.rejected_at,
          ec.created_at,
          ec.updated_at
        FROM employee_contracts ec
        INNER JOIN users u
          ON u.id = ec.user_id
        LEFT JOIN users rejected_user
          ON rejected_user.id = ec.rejected_by_user_id
        WHERE ec.id = ?
        LIMIT 1
      `,
      [contractId],
    );

    const contract = contracts[0];

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contractul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      success: true,
      contract: {
        id: contract.id,
        userId: contract.user_id,
        username: contract.username,
        firstName: contract.first_name,
        lastName: contract.last_name,
        age: contract.age,
        gameId: contract.game_id,
        ciSeries: contract.ci_series,
        phoneNumber: contract.phone_number,
        cityHours: contract.city_hours,
        identityImagePath: contract.identity_image_path,
        acceptedRules: Boolean(contract.accepted_rules),
        employeeSignatureName: contract.employee_signature_name,
        status: contract.status,
        contractCreationBlocked: Boolean(contract.contract_creation_blocked),
        signedAt: contract.signed_at,
        approvedByUserId: contract.approved_by_user_id,
        approvedByName: contract.approved_by_name,
        adminSignaturePath: contract.admin_signature_path,
        approvedAt: contract.approved_at,
        rejectedByUserId: contract.rejected_by_user_id,
        rejectedByName: contract.rejected_by_name,
        rejectedAt: contract.rejected_at,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
      },
    });
  } catch (error) {
    console.error("Get admin contract details error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la încărcarea contractului.",
    });
  }
});

router.post("/admin/:contractId/approve", requireAdmin, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const contractId = Number(req.params.contractId);
    const sessionUser = req.session.user;

    if (!Number.isInteger(contractId) || contractId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul contractului nu este valid.",
      });
    }

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu există o sesiune activă.",
      });
    }

    await connection.beginTransaction();

    interface ContractApprovalRow extends RowDataPacket {
      id: number;
      user_id: number;
      status: ContractStatus;
    }

    const [contracts] = await connection.execute<ContractApprovalRow[]>(
      `
        SELECT
          id,
          user_id,
          status
        FROM employee_contracts
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [contractId],
    );

    const contract = contracts[0];

    if (!contract) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Contractul nu a fost găsit.",
      });
    }

    if (contract.status !== "PENDING_REVIEW") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Contractul nu mai este în așteptare.",
      });
    }

    const [userResult] = await connection.execute<ResultSetHeader>(
      `
    UPDATE users
    SET user_role_id = (
      SELECT id
      FROM user_roles
      WHERE name = 'ANGAJAT'
      LIMIT 1
    )
    WHERE id = ?
      AND user_role_id = (
        SELECT id
        FROM user_roles
        WHERE name = 'GUEST'
        LIMIT 1
      )
  `,
      [contract.user_id],
    );

    if (userResult.affectedRows === 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Utilizatorul contractului nu mai are rolul GUEST și nu poate fi aprobat.",
      });
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE employee_contracts
        SET
          status = 'APPROVED',
          approved_by_user_id = ?,
          approved_by_name = ?,
          approved_at = CURRENT_TIMESTAMP,
          rejected_at = NULL,
          admin_signature_path = NULL
        WHERE id = ?
      `,
      [sessionUser.id, sessionUser.username, contractId],
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Contractul a fost aprobat, iar utilizatorul a devenit ANGAJAT.",
      approval: {
        approvedByUserId: sessionUser.id,
        approvedByName: sessionUser.username,
        approvedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Approve contract error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la aprobarea contractului.",
    });
  } finally {
    connection.release();
  }
});

router.post("/admin/:contractId/reject", requireAdmin, async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);
    const sessionUser = req.session.user;

    if (!Number.isInteger(contractId) || contractId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul contractului nu este valid.",
      });
    }

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Sesiunea utilizatorului nu este validă.",
      });
    }

    const [result] = await db.execute<ResultSetHeader>(
      `
        UPDATE employee_contracts
        SET
          status = 'REJECTED',
          rejected_by_user_id = ?,
          rejected_at = CURRENT_TIMESTAMP,
          approved_at = NULL,
          approved_by_user_id = NULL,
          approved_by_name = NULL,
          admin_signature_path = NULL
        WHERE id = ?
          AND status = 'PENDING_REVIEW'
      `,
      [sessionUser.id, contractId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Contractul nu există sau nu mai este în așteptare.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contract respins.",
    });
  } catch (error) {
    console.error("Reject contract error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la respingerea contractului.",
    });
  }
});

router.get("/admin/:contractId/document", requireAdmin, async (req, res) => {
  try {
    const contractId = Number(req.params.contractId);

    if (!Number.isInteger(contractId) || contractId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID-ul contractului nu este valid.",
      });
    }

    const [rows] = await db.query<GeneratedContractRow[]>(
      `
          SELECT
            ed.document_number,
            ed.current_version,
            edv.png_path,
            edv.pdf_path,
            edv.generated_at
          FROM employee_documents ed
          INNER JOIN employee_document_versions edv
            ON edv.document_id = ed.id
            AND edv.version_number = ed.current_version
          WHERE ed.contract_id = ?
          LIMIT 1
        `,
      [contractId],
    );

    const document = rows[0];

    if (!document) {
      return res.status(200).json({
        success: true,
        document: null,
      });
    }

    return res.status(200).json({
      success: true,
      document: {
        documentNumber: document.document_number,
        currentVersion: document.current_version,
        pngPath: document.png_path,
        pdfPath: document.pdf_path,
        generatedAt: document.generated_at,
      },
    });
  } catch (error) {
    console.error("Get generated contract error:", error);

    return res.status(500).json({
      success: false,
      message: "Documentul generat nu a putut fi încărcat.",
    });
  }
});

export default router;
