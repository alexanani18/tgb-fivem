import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../db";
import { requireAuth } from "../services/requireAuth";

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
  rejection_reason: string | null;
  contract_creation_blocked: number;
  signed_at: Date | null;
  approved_by_user_id: number | null;
  approved_by_name: string | null;
  admin_signature_path: string | null;
  approved_at: Date | null;
  rejected_at: Date | null;
  created_at: Date;
  updated_at: Date;
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
          id,
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
          rejection_reason,
          contract_creation_blocked,
          signed_at,
          approved_by_user_id,
          approved_by_name,
          admin_signature_path,
          approved_at,
          rejected_at,
          created_at,
          updated_at
        FROM employee_contracts
        WHERE user_id = ?
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
        rejectionReason: contract.rejection_reason,
        contractCreationBlocked: Boolean(contract.contract_creation_blocked),
        signedAt: contract.signed_at,
        approvedByUserId: contract.approved_by_user_id,
        approvedByName: contract.approved_by_name,
        adminSignaturePath: contract.admin_signature_path,
        approvedAt: contract.approved_at,
        rejectedAt: contract.rejected_at,
        createdAt: contract.created_at,
        updatedAt: contract.updated_at,
      },
      canCreateContract:
        sessionUser.role === "GUEST" &&
        !contract.contract_creation_blocked &&
        ["DRAFT", "REJECTED"].includes(contract.status),
    });
  } catch (error) {
    console.error("Get own contract error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la încărcarea contractului.",
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
              rejection_reason = NULL,
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

export default router;
