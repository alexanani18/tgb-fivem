import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";

import { db } from "../db";
import { requireAuth } from "../services/requireAuth";
import { requireAdmin } from "../services/requireAdmin";
import { generateEmployeeContract } from "../services/contractGenerationService";

import * as contractsDatabase from "../database/contracts";

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

  filename: (_req, _file, callback) => {
    const fileName = `identity-${Date.now()}.jpg`;

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

router.get("/me", requireAuth, async (req, res) => {
  try {
    const sessionUser = req.session.user;

    if (!sessionUser) {
      return res.status(401).json({
        success: false,
        message: "Nu există o sesiune activă.",
      });
    }

    const contract = await contractsDatabase.getOwnContract(sessionUser.id);

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
        workSchedule: contract.work_schedule,
        contractType: contract.contract_type,
        contractEndDate: contract.contract_end_date,
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

    const document =
      await contractsDatabase.getGeneratedDocumentByUserId(
        sessionUser.id,
      );

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

    if (req.file) {
      const processedFilePath = `${req.file.path}.processed`;

      try {
        const imageMetadata = await sharp(req.file.path).metadata();

        if (
          imageMetadata.format !== "jpeg" &&
          imageMetadata.format !== "png"
        ) {
          deleteUploadedFile(uploadedFilePath);

          return res.status(400).json({
            success: false,
            message: "Poza buletinului trebuie să fie un JPEG sau PNG valid.",
          });
        }

        await sharp(req.file.path)
          .jpeg({
            quality: 90,
            mozjpeg: true,
          })
          .toFile(processedFilePath);

        fs.renameSync(processedFilePath, req.file.path);
      } catch (error) {
        console.error("Identity image validation error:", error);

        deleteUploadedFile(uploadedFilePath);
        deleteUploadedFile(processedFilePath);

        return res.status(400).json({
          success: false,
          message: "Fișierul încărcat nu este o imagine validă.",
        });
      }
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

      const existingContract =
        await contractsDatabase.getExistingContract(
          connection,
          sessionUser.id,
        );

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

        await contractsDatabase.updatePendingEmployeeContract(
          connection,
          existingContract.id,
          {
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            age: normalizedAge,
            gameId: normalizedGameId,
            ciSeries: normalizedCiSeries,
            phoneNumber: normalizedPhoneNumber,
            cityHours: normalizedCityHours,
            identityImagePath,
            employeeSignatureName,
          },
        );
      } else {
        await contractsDatabase.createPendingEmployeeContract(
          connection,
          {
            userId: sessionUser.id,
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            age: normalizedAge,
            gameId: normalizedGameId,
            ciSeries: normalizedCiSeries,
            phoneNumber: normalizedPhoneNumber,
            cityHours: normalizedCityHours,
            identityImagePath,
            employeeSignatureName,
          },
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
    const contracts = await contractsDatabase.getAdminContracts();

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
        workSchedule: contract.work_schedule,
        contractType: contract.contract_type,
        contractEndDate: contract.contract_end_date,
        rejectedByUserId: contract.rejected_by_user_id,
        rejectedByName: contract.rejected_by_name,
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

    const requestBody = req.body ?? {};

    const hasSettingsUpdate =
      requestBody.workSchedule !== undefined ||
      requestBody.contractType !== undefined ||
      requestBody.contractEndDate !== undefined;

    if (hasSettingsUpdate) {
      const workSchedule =
        typeof requestBody.workSchedule === "string"
          ? requestBody.workSchedule.trim()
          : "";

      const contractType =
        requestBody.contractType === "FIXED"
          ? "FIXED"
          : requestBody.contractType === "UNLIMITED"
            ? "UNLIMITED"
            : null;

      const contractEndDate =
        typeof requestBody.contractEndDate === "string" &&
          requestBody.contractEndDate.trim()
          ? requestBody.contractEndDate.trim()
          : null;

      if (!workSchedule) {
        return res.status(400).json({
          success: false,
          message: "Programul de lucru este obligatoriu.",
        });
      }

      if (workSchedule.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Programul de lucru poate avea maximum 50 de caractere.",
        });
      }

      if (!contractType) {
        return res.status(400).json({
          success: false,
          message: "Tipul contractului nu este valid.",
        });
      }

      if (contractType === "FIXED") {
        if (
          !contractEndDate ||
          !/^\d{4}-\d{2}-\d{2}$/.test(contractEndDate) ||
          Number.isNaN(new Date(`${contractEndDate}T00:00:00`).getTime())
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Data expirării este obligatorie pentru contractul determinat.",
          });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const parsedEndDate = new Date(`${contractEndDate}T00:00:00`);

        if (parsedEndDate < today) {
          return res.status(400).json({
            success: false,
            message: "Data expirării nu poate fi în trecut.",
          });
        }
      }

      const updated = await contractsDatabase.updateApprovedContract(
        contractId,
        {
          workSchedule,
          contractType,
          contractEndDate:
            contractType === "FIXED" ? contractEndDate : null,
        },
      );

      if (!updated) {
        return res.status(409).json({
          success: false,
          message:
            "Contractul nu există sau nu este aprobat și nu poate fi regenerat.",
        });
      }
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
    const pendingCount = await contractsDatabase.getPendingContractsCount();

    return res.status(200).json({
      success: true,
      pendingCount,
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

    const contract = await contractsDatabase.getAdminContractById(contractId);

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
        workSchedule: contract.work_schedule,
        contractType: contract.contract_type,
        contractEndDate: contract.contract_end_date,
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

    const rankId = Number(req.body.rankId);

    const workSchedule =
      typeof req.body.workSchedule === "string"
        ? req.body.workSchedule.trim()
        : "";

    const contractType =
      req.body.contractType === "FIXED"
        ? "FIXED"
        : req.body.contractType === "UNLIMITED"
          ? "UNLIMITED"
          : null;

    const contractEndDate =
      typeof req.body.contractEndDate === "string" &&
        req.body.contractEndDate.trim()
        ? req.body.contractEndDate.trim()
        : null;

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

    if (!Number.isInteger(rankId) || rankId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Selectează un rank valid pentru angajat.",
      });
    }

    if (!workSchedule) {
      return res.status(400).json({
        success: false,
        message: "Programul de lucru este obligatoriu.",
      });
    }

    if (workSchedule.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Programul de lucru poate avea maximum 50 de caractere.",
      });
    }

    if (!contractType) {
      return res.status(400).json({
        success: false,
        message: "Tipul contractului nu este valid.",
      });
    }

    if (contractType === "FIXED") {
      if (
        !contractEndDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(contractEndDate) ||
        Number.isNaN(new Date(`${contractEndDate}T00:00:00`).getTime())
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Data expirării este obligatorie pentru contractul determinat.",
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const parsedEndDate = new Date(`${contractEndDate}T00:00:00`);

      if (parsedEndDate < today) {
        return res.status(400).json({
          success: false,
          message: "Data expirării nu poate fi în trecut.",
        });
      }
    }

    await connection.beginTransaction();

    const rankExists = await contractsDatabase.rankExists(
      connection,
      rankId,
    );

    if (!rankExists) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Rank-ul selectat nu există.",
      });
    }

    const contract = await contractsDatabase.getContractForApproval(
      connection,
      contractId,
    );

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

    const approverDisplayName =
      await contractsDatabase.getUserDisplayName(
        connection,
        sessionUser.id,
        sessionUser.username,
      );
    const approved = await contractsDatabase.approveEmployeeContract(
      connection,
      contractId,
      contract.user_id,
      {
        approverUserId: sessionUser.id,
        approverName: approverDisplayName,
        rankId,
        workSchedule,
        contractType,
        contractEndDate:
          contractType === "FIXED" ? contractEndDate : null,
      },
    );

    if (!approved) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Utilizatorul contractului nu mai are rolul GUEST și nu poate fi aprobat.",
      });
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Contractul a fost aprobat, iar utilizatorul a devenit ANGAJAT.",
      approval: {
        approvedByUserId: sessionUser.id,
        approvedByName: approverDisplayName,
        approvedAt: new Date().toISOString(),
        rankId,
        workSchedule,
        contractType,
        contractEndDate: contractType === "FIXED" ? contractEndDate : null,
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
        message: "Sesiunea utilizatorului nu este validă.",
      });
    }

    const rejecterDisplayName =
      await contractsDatabase.getUserDisplayName(
        connection,
        sessionUser.id,
        sessionUser.username,
      );

    const updated = await contractsDatabase.rejectContract(
      contractId,
      sessionUser.id,
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Contractul nu există sau nu mai este în așteptare.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contract respins.",
      rejection: {
        rejectedByUserId: sessionUser.id,
        rejectedByName: rejecterDisplayName,
        rejectedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Reject contract error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la respingerea contractului.",
    });
  } finally {
    connection.release();
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

    const document =
      await contractsDatabase.getGeneratedDocumentByContractId(
        contractId,
      );

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
