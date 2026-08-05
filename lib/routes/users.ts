import { Router } from "express";
import bcrypt from "bcryptjs";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";

import { db } from "../db";
import { requireAdmin } from "../services/requireAdmin";

const router = Router();

type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "GUEST" | "DEV";

type EmployeeStatus = "ACTIV" | "CONCEDIU" | "DEMISIONAT";

type ContractStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

interface ExistingUserRow extends RowDataPacket {
  id: number;
}

interface RoleRow extends RowDataPacket {
  id: number;
  name: UserRole;
}

interface RankRow extends RowDataPacket {
  id: number;
  name: string;
  sort_order: number;
}

interface EmployeeUserRow extends RowDataPacket {
  id: number;

  first_name: string;
  last_name: string;

  iban: string | number | null;
  phone_number: string | null;
  ci_series: string | null;
  city_hours: string | number | null;

  employee_rank: string | null;
  employee_status: EmployeeStatus | null;

  meeting_attendance: number | null;
  has_uniform: number | null;
  has_car: number | null;

  observations: string | null;
  discord_id: string | null;

  created_at: Date;
}

interface EmployeeExistsRow extends RowDataPacket {
  id: number;
}

interface EmployeeDetailsRow extends RowDataPacket {
  id: number;
  username: string;
  is_active: number;
  created_at: Date;
  updated_at: Date;

  website_role: UserRole;

  employee_rank_id: number | null;
  employee_rank: string | null;

  first_name: string | null;
  last_name: string | null;
  age: number | null;
  iban: string | number | null;
  ci_series: string | null;
  phone_number: string | null;
  city_hours: string | number | null;
  identity_image_path: string | null;
  employee_signature_name: string | null;

  contract_status: ContractStatus | null;

  signed_at: Date | null;
  approved_by_name: string | null;
  admin_signature_path: string | null;
  approved_at: Date | null;
  rejected_at: Date | null;

  employee_status: EmployeeStatus | null;
  meeting_attendance: number | null;
  has_uniform: number | null;
  has_car: number | null;
  discord_id: string | null;
  observations: string | null;
}

interface EmployeeContractExistsRow extends RowDataPacket {
  id: number;
}

interface EmployeeIdentityRow extends RowDataPacket {
  id: number;
  identity_image_path: string | null;
}

const CONTRACT_IDENTITIES_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "contract-images",
);

if (!fs.existsSync(CONTRACT_IDENTITIES_DIRECTORY)) {
  fs.mkdirSync(CONTRACT_IDENTITIES_DIRECTORY, {
    recursive: true,
  });
}

const CONTRACT_IMAGES_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "contract-images",
);

const identityImageStorage = multer.diskStorage({
  destination(req, _file, callback) {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      callback(new Error("ID-ul angajatului este invalid."), "");
      return;
    }

    const userDirectory = path.join(CONTRACT_IMAGES_DIRECTORY, String(userId));

    if (!fs.existsSync(userDirectory)) {
      fs.mkdirSync(userDirectory, {
        recursive: true,
      });
    }

    callback(null, userDirectory);
  },

  filename(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    callback(null, `identity-${Date.now()}${extension}`);
  },
});

const identityImageUpload = multer({
  storage: identityImageStorage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    if (!allowedExtensions.includes(extension)) {
      callback(
        new Error("Sunt acceptate doar imagini JPG, JPEG, PNG sau WEBP."),
      );

      return;
    }

    callback(null, true);
  },
});

const uploadIdentityImage = identityImageUpload.single("identityImage");

const allowedRoles: UserRole[] = ["GUEST", "ADMIN", "ANGAJAT", "MAFIA", "DEV"];

const allowedEmployeeStatuses: EmployeeStatus[] = [
  "ACTIV",
  "CONCEDIU",
  "DEMISIONAT",
];

const allowedContractStatuses: ContractStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
];

function parsePositiveInteger(value: unknown): number | null {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function normalizeOptionalText(
  value: unknown,
  maximumLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maximumLength) {
    return undefined;
  }

  return normalizedValue || null;
}

async function employeeExists(
  connection: PoolConnection,
  userId: number,
): Promise<boolean> {
  const [employees] = await connection.execute<EmployeeExistsRow[]>(
    `
      SELECT
        u.id
      FROM users u

      INNER JOIN user_roles ur
        ON ur.id = u.user_role_id

      WHERE u.id = ?
        AND ur.name IN ('ANGAJAT', 'MAFIA')

      LIMIT 1
    `,
    [userId],
  );

  return employees.length > 0;
}

async function ensureEmployeeDetails(
  connection: PoolConnection,
  userId: number,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO employee_details (
        user_id,
        status,
        meeting_attendance,
        has_uniform,
        has_car
      )
      VALUES (?, 'ACTIV', 0, 0, 0)

      ON DUPLICATE KEY UPDATE
        user_id = ?
    `,
    [userId, userId],
  );
}

/*
|--------------------------------------------------------------------------
| GET /users
|--------------------------------------------------------------------------
*/

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const [users] = await db.execute<EmployeeUserRow[]>(
      `
        SELECT
          u.id,

          COALESCE(ec.first_name, u.username) AS first_name,
          COALESCE(ec.last_name, '') AS last_name,

          ec.game_id AS iban,
          ec.phone_number,
          ec.ci_series,
          ec.city_hours,

          rk.name AS employee_rank,

          ed.status AS employee_status,
          ed.meeting_attendance,
          ed.has_uniform,
          ed.has_car,
          ed.observations,
          ed.discord_id,

          u.created_at

        FROM users u

        INNER JOIN user_roles ur
          ON ur.id = u.user_role_id

        LEFT JOIN user_ranks rk
          ON rk.id = u.user_rank_id

        LEFT JOIN employee_contracts ec
          ON ec.user_id = u.id

        LEFT JOIN employee_details ed
          ON ed.user_id = u.id

        WHERE ur.name IN ('ANGAJAT', 'MAFIA')
          AND (
            ed.status IS NULL
            OR ed.status <> 'DEMISIONAT'
          )

        ORDER BY
          COALESCE(rk.sort_order, 999) ASC,
          COALESCE(ec.last_name, u.username) ASC,
          COALESCE(ec.first_name, u.username) ASC
      `,
    );

    return res.status(200).json({
      success: true,

      users: users.map((user) => ({
        id: user.id,

        firstName: user.first_name,
        lastName: user.last_name,

        iban: user.iban ?? "—",

        status: user.employee_status ?? "ACTIV",

        phoneNumber: user.phone_number ?? "—",
        ciSeries: user.ci_series ?? "—",
        cityHours: user.city_hours ?? "—",

        rank: user.employee_rank ?? "Fără grad",

        meetingAttendance: Boolean(user.meeting_attendance),

        createdAt: user.created_at,

        observations: user.observations ?? "",
        discordId: user.discord_id ?? "",

        hasUniform: Boolean(user.has_uniform),
        hasCar: Boolean(user.has_car),
      })),
    });
  } catch (error) {
    console.error("Get employees error:", error);

    return res.status(500).json({
      success: false,
      message: "Eroare internă la încărcarea angajaților.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /users/ranks
|--------------------------------------------------------------------------
*/

router.get("/ranks", requireAdmin, async (_req, res) => {
  try {
    const [ranks] = await db.execute<RankRow[]>(
      `
        SELECT
          id,
          name,
          sort_order
        FROM user_ranks
        ORDER BY sort_order ASC, name ASC
      `,
    );

    return res.status(200).json({
      success: true,

      ranks: ranks.map((rank) => ({
        id: rank.id,
        name: rank.name,
        sortOrder: rank.sort_order,
      })),
    });
  } catch (error) {
    console.error("Get user ranks error:", error);

    return res.status(500).json({
      success: false,
      message: "Gradele nu au putut fi încărcate.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /users/:userId
|--------------------------------------------------------------------------
*/

router.get("/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "ID-ul angajatului este invalid.",
      });
    }

    const [employees] = await db.execute<EmployeeDetailsRow[]>(
      `
        SELECT
          u.id,
          u.username,
          u.is_active,
          u.created_at,
          u.updated_at,

          ur.name AS website_role,

          u.user_rank_id AS employee_rank_id,
          rk.name AS employee_rank,

          ec.first_name,
          ec.last_name,
          ec.age,
          ec.game_id AS iban,
          ec.ci_series,
          ec.phone_number,
          ec.city_hours,
          ec.identity_image_path,
          ec.employee_signature_name,
          ec.status AS contract_status,
          ec.signed_at,
          ec.approved_by_name,
          ec.admin_signature_path,
          ec.approved_at,
          ec.rejected_at,

          ed.status AS employee_status,
          ed.meeting_attendance,
          ed.has_uniform,
          ed.has_car,
          ed.discord_id,
          ed.observations

        FROM users u

        INNER JOIN user_roles ur
          ON ur.id = u.user_role_id

        LEFT JOIN user_ranks rk
          ON rk.id = u.user_rank_id

        LEFT JOIN employee_contracts ec
          ON ec.user_id = u.id

        LEFT JOIN employee_details ed
          ON ed.user_id = u.id

        WHERE u.id = ?
          AND ur.name IN ('ANGAJAT', 'MAFIA')

        LIMIT 1
      `,
      [userId],
    );

    const employee = employees[0];

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Angajatul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      success: true,

      employee: {
        id: employee.id,
        username: employee.username,

        websiteRole: employee.website_role,

        rankId: employee.employee_rank_id,
        rank: employee.employee_rank ?? "Fără grad",

        isActive: Boolean(employee.is_active),

        status: employee.employee_status ?? "ACTIV",

        createdAt: employee.created_at,
        updatedAt: employee.updated_at,

        meetingAttendance: Boolean(employee.meeting_attendance),
        hasUniform: Boolean(employee.has_uniform),
        hasCar: Boolean(employee.has_car),

        discordId: employee.discord_id ?? "",
        observations: employee.observations ?? "",

        contract: {
          firstName: employee.first_name ?? "",
          lastName: employee.last_name ?? "",
          age: employee.age,
          iban: employee.iban ?? "",
          ciSeries: employee.ci_series ?? "",
          phoneNumber: employee.phone_number ?? "",
          cityHours: employee.city_hours ?? "",
          identityImagePath: employee.identity_image_path,
          employeeSignatureName: employee.employee_signature_name,
          status: employee.contract_status,
          signedAt: employee.signed_at,
          approvedByName: employee.approved_by_name,
          adminSignaturePath: employee.admin_signature_path,
          approvedAt: employee.approved_at,
          rejectedAt: employee.rejected_at,
        },
      },
    });
  } catch (error) {
    console.error("Get employee details error:", error);

    return res.status(500).json({
      success: false,
      message: "Datele angajatului nu au putut fi încărcate.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /users/:userId/resign
|--------------------------------------------------------------------------
|
| Marchează angajatul ca DEMISIONAT și dezactivează contul.
|
*/

router.patch("/:userId/resign", requireAdmin, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "ID-ul angajatului este invalid.",
      });
    }

    await connection.beginTransaction();

    const exists = await employeeExists(connection, userId);

    if (!exists) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Angajatul nu a fost găsit.",
      });
    }

    await ensureEmployeeDetails(connection, userId);

    await connection.execute<ResultSetHeader>(
      `
        UPDATE employee_details
        SET status = 'DEMISIONAT'
        WHERE user_id = ?
      `,
      [userId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET is_active = 0
        WHERE id = ?
      `,
      [userId],
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Angajatul a fost marcat ca demisionat.",
    });
  } catch (error) {
    await connection.rollback();

    console.error("Resign employee error:", error);

    return res.status(500).json({
      success: false,
      message: "Angajatul nu a putut fi marcat ca demisionat.",
    });
  } finally {
    connection.release();
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /users/:userId/contract/identity-image
|--------------------------------------------------------------------------
|
| Înlocuiește poza de buletin.
|
*/

router.patch(
  "/:userId/contract/identity-image",
  requireAdmin,
  uploadIdentityImage,
  async (req, res) => {
    try {
      const userId = parsePositiveInteger(req.params.userId);

      if (!userId) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: "ID-ul angajatului este invalid.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Nu ai selectat nicio imagine.",
        });
      }

      const [contracts] = await db.execute<EmployeeIdentityRow[]>(
        `
          SELECT
            id,
            identity_image_path
          FROM employee_contracts
          WHERE user_id = ?
          LIMIT 1
        `,
        [userId],
      );

      const contract = contracts[0];

      if (!contract) {
        fs.unlinkSync(req.file.path);

        return res.status(404).json({
          success: false,
          message: "Contractul angajatului nu a fost găsit.",
        });
      }

      const newRelativePath = `/contract-images/${userId}/${req.file.filename}`;

      await db.execute<ResultSetHeader>(
        `
          UPDATE employee_contracts
          SET identity_image_path = ?
          WHERE user_id = ?
        `,
        [newRelativePath, userId],
      );

      if (contract.identity_image_path) {
        const oldFilePath = path.join(
          process.cwd(),
          "public",
          contract.identity_image_path.replace(/^\/+/, ""),
        );

        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (error) {
            console.error("Old identity image could not be deleted:", error);
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Poza de buletin a fost actualizată.",
        identityImagePath: newRelativePath,
      });
    } catch (error) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Fișierul nu mai există.
        }
      }

      console.error("Update identity image error:", error);

      return res.status(500).json({
        success: false,
        message: "Poza de buletin nu a putut fi actualizată.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| PATCH /users/:userId/contract
|--------------------------------------------------------------------------
|
| Actualizează datele contractului unui angajat.
| Doar ADMIN.
|
*/

router.patch("/:userId/contract", requireAdmin, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "ID-ul angajatului este invalid.",
      });
    }

    const {
      firstName,
      lastName,
      age,
      iban,
      ciSeries,
      phoneNumber,
      cityHours,
      status,
      employeeSignatureName,
    } = req.body;

    if (
      typeof firstName !== "string" ||
      typeof lastName !== "string" ||
      typeof ciSeries !== "string" ||
      typeof phoneNumber !== "string" ||
      typeof employeeSignatureName !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Datele contractului sunt invalide.",
      });
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedCiSeries = ciSeries.trim();
    const normalizedPhoneNumber = phoneNumber.trim();
    const normalizedSignatureName = employeeSignatureName.trim();

    if (!normalizedFirstName || normalizedFirstName.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Numele este obligatoriu și poate avea maximum 100 de caractere.",
      });
    }

    if (!normalizedLastName || normalizedLastName.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Prenumele este obligatoriu și poate avea maximum 100 de caractere.",
      });
    }

    const normalizedAge = Number(age);

    if (
      !Number.isInteger(normalizedAge) ||
      normalizedAge < 18 ||
      normalizedAge > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Vârsta trebuie să fie un număr între 18 și 100.",
      });
    }

    const normalizedIban =
      typeof iban === "string" || typeof iban === "number"
        ? String(iban).trim()
        : "";

    if (!normalizedIban || normalizedIban.length > 50) {
      return res.status(400).json({
        success: false,
        message: "IBAN-ul este obligatoriu și nu poate depăși 50 de caractere.",
      });
    }

    if (!normalizedCiSeries || normalizedCiSeries.length > 50) {
      return res.status(400).json({
        success: false,
        message:
          "Seria CI este obligatorie și nu poate depăși 50 de caractere.",
      });
    }

    if (!normalizedPhoneNumber || normalizedPhoneNumber.length > 50) {
      return res.status(400).json({
        success: false,
        message:
          "Numărul de telefon este obligatoriu și nu poate depăși 50 de caractere.",
      });
    }

    const normalizedCityHours = Number(cityHours);

    if (!Number.isInteger(normalizedCityHours) || normalizedCityHours < 0) {
      return res.status(400).json({
        success: false,
        message: "Valoarea pentru Luni trebuie să fie un număr pozitiv.",
      });
    }

    const normalizedStatus =
      typeof status === "string"
        ? (status.trim().toUpperCase() as ContractStatus)
        : null;

    if (
      !normalizedStatus ||
      !allowedContractStatuses.includes(normalizedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Statusul contractului este invalid.",
      });
    }

    if (!normalizedSignatureName || normalizedSignatureName.length > 200) {
      return res.status(400).json({
        success: false,
        message:
          "Semnătura angajatului este obligatorie și poate avea maximum 200 de caractere.",
      });
    }

    await connection.beginTransaction();

    const exists = await employeeExists(connection, userId);

    if (!exists) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Angajatul nu a fost găsit.",
      });
    }

    const [contracts] = await connection.execute<EmployeeContractExistsRow[]>(
      `
          SELECT id
          FROM employee_contracts
          WHERE user_id = ?
          LIMIT 1
        `,
      [userId],
    );

    if (contracts.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Contractul angajatului nu a fost găsit.",
      });
    }

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
          status = ?,
          employee_signature_name = ?
        WHERE user_id = ?
      `,
      [
        normalizedFirstName,
        normalizedLastName,
        normalizedAge,
        normalizedIban,
        normalizedCiSeries,
        normalizedPhoneNumber,
        normalizedCityHours,
        normalizedStatus,
        normalizedSignatureName,
        userId,
      ],
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Datele contractului au fost actualizate.",
    });
  } catch (error) {
    await connection.rollback();

    console.error("Update employee contract error:", error);

    return res.status(500).json({
      success: false,
      message: "Datele contractului nu au putut fi actualizate.",
    });
  } finally {
    connection.release();
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /users/:userId/details
|--------------------------------------------------------------------------
|
| Actualizare rapidă din tabel:
| - Prezență ședință
| - Uniformă
| - Mașină
|
*/

router.patch("/:userId/details", requireAdmin, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "ID-ul angajatului este invalid.",
      });
    }

    const { meetingAttendance, hasUniform, hasCar } = req.body;

    const includesMeetingAttendance = meetingAttendance !== undefined;
    const includesUniform = hasUniform !== undefined;
    const includesCar = hasCar !== undefined;

    if (!includesMeetingAttendance && !includesUniform && !includesCar) {
      return res.status(400).json({
        success: false,
        message: "Nu a fost trimisă nicio modificare.",
      });
    }

    if (includesMeetingAttendance && typeof meetingAttendance !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Valoarea pentru prezența la ședință este invalidă.",
      });
    }

    if (includesUniform && typeof hasUniform !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Valoarea pentru uniformă este invalidă.",
      });
    }

    if (includesCar && typeof hasCar !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Valoarea pentru mașină este invalidă.",
      });
    }

    await connection.beginTransaction();

    const exists = await employeeExists(connection, userId);

    if (!exists) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Angajatul nu a fost găsit.",
      });
    }

    await ensureEmployeeDetails(connection, userId);

    const updateFields: string[] = [];
    const updateValues: number[] = [];

    if (includesMeetingAttendance) {
      updateFields.push("meeting_attendance = ?");
      updateValues.push(meetingAttendance ? 1 : 0);
    }

    if (includesUniform) {
      updateFields.push("has_uniform = ?");
      updateValues.push(hasUniform ? 1 : 0);
    }

    if (includesCar) {
      updateFields.push("has_car = ?");
      updateValues.push(hasCar ? 1 : 0);
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE employee_details
        SET ${updateFields.join(", ")}
        WHERE user_id = ?
      `,
      [...updateValues, userId],
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Informația angajatului a fost actualizată.",

      employee: {
        id: userId,

        ...(includesMeetingAttendance ? { meetingAttendance } : {}),

        ...(includesUniform ? { hasUniform } : {}),

        ...(includesCar ? { hasCar } : {}),
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("Update employee details error:", error);

    return res.status(500).json({
      success: false,
      message: "Informația angajatului nu a putut fi actualizată.",
    });
  } finally {
    connection.release();
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /users/:userId
|--------------------------------------------------------------------------
|
| Actualizează informațiile din tab-ul General.
|
*/

router.patch("/:userId", requireAdmin, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = parsePositiveInteger(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "ID-ul angajatului este invalid.",
      });
    }

    const {
      rankId,
      status,
      isActive,
      discordId,
      observations,
      meetingAttendance,
      hasUniform,
      hasCar,
    } = req.body;

    const includesRank = rankId !== undefined;
    const includesStatus = status !== undefined;
    const includesIsActive = isActive !== undefined;
    const includesDiscordId = discordId !== undefined;
    const includesObservations = observations !== undefined;
    const includesMeetingAttendance = meetingAttendance !== undefined;
    const includesUniform = hasUniform !== undefined;
    const includesCar = hasCar !== undefined;

    if (
      !includesRank &&
      !includesStatus &&
      !includesIsActive &&
      !includesDiscordId &&
      !includesObservations &&
      !includesMeetingAttendance &&
      !includesUniform &&
      !includesCar
    ) {
      return res.status(400).json({
        success: false,
        message: "Nu a fost trimisă nicio modificare.",
      });
    }

    const normalizedRankId = includesRank ? parsePositiveInteger(rankId) : null;

    if (includesRank && !normalizedRankId) {
      return res.status(400).json({
        success: false,
        message: "Gradul selectat este invalid.",
      });
    }

    const normalizedStatus =
      typeof status === "string"
        ? (status.trim().toUpperCase() as EmployeeStatus)
        : null;

    if (
      includesStatus &&
      (!normalizedStatus || !allowedEmployeeStatuses.includes(normalizedStatus))
    ) {
      return res.status(400).json({
        success: false,
        message: "Statusul selectat este invalid.",
      });
    }

    if (includesIsActive && typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Valoarea pentru starea contului este invalidă.",
      });
    }

    if (includesMeetingAttendance && typeof meetingAttendance !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Valoarea pentru prezența la ședință este invalidă.",
      });
    }

    if (includesUniform && typeof hasUniform !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Valoarea pentru uniformă este invalidă.",
      });
    }

    if (includesCar && typeof hasCar !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Valoarea pentru mașină este invalidă.",
      });
    }

    const normalizedDiscordId = normalizeOptionalText(discordId, 30);
    const normalizedObservations = normalizeOptionalText(observations, 1000);

    if (includesDiscordId && normalizedDiscordId === undefined) {
      return res.status(400).json({
        success: false,
        message: "ID-ul Discord este invalid sau prea lung.",
      });
    }

    if (includesObservations && normalizedObservations === undefined) {
      return res.status(400).json({
        success: false,
        message: "Observațiile pot avea maximum 1000 de caractere.",
      });
    }

    await connection.beginTransaction();

    const exists = await employeeExists(connection, userId);

    if (!exists) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Angajatul nu a fost găsit.",
      });
    }

    if (includesRank && normalizedRankId) {
      const [ranks] = await connection.execute<RankRow[]>(
        `
          SELECT
            id,
            name,
            sort_order
          FROM user_ranks
          WHERE id = ?
          LIMIT 1
        `,
        [normalizedRankId],
      );

      if (ranks.length === 0) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: "Gradul selectat nu există.",
        });
      }
    }

    const userUpdateFields: string[] = [];
    const userUpdateValues: number[] = [];

    if (includesRank && normalizedRankId) {
      userUpdateFields.push("user_rank_id = ?");
      userUpdateValues.push(normalizedRankId);
    }

    if (includesIsActive) {
      userUpdateFields.push("is_active = ?");
      userUpdateValues.push(isActive ? 1 : 0);
    }

    if (userUpdateFields.length > 0) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE users
          SET ${userUpdateFields.join(", ")}
          WHERE id = ?
        `,
        [...userUpdateValues, userId],
      );
    }

    const mustUpdateEmployeeDetails =
      includesStatus ||
      includesDiscordId ||
      includesObservations ||
      includesMeetingAttendance ||
      includesUniform ||
      includesCar;

    if (mustUpdateEmployeeDetails) {
      await ensureEmployeeDetails(connection, userId);

      const detailUpdateFields: string[] = [];
      const detailUpdateValues: Array<number | string | null> = [];

      if (includesStatus && normalizedStatus) {
        detailUpdateFields.push("status = ?");
        detailUpdateValues.push(normalizedStatus);
      }

      if (includesDiscordId) {
        detailUpdateFields.push("discord_id = ?");
        detailUpdateValues.push(normalizedDiscordId ?? null);
      }

      if (includesObservations) {
        detailUpdateFields.push("observations = ?");
        detailUpdateValues.push(normalizedObservations ?? null);
      }

      if (includesMeetingAttendance) {
        detailUpdateFields.push("meeting_attendance = ?");
        detailUpdateValues.push(meetingAttendance ? 1 : 0);
      }

      if (includesUniform) {
        detailUpdateFields.push("has_uniform = ?");
        detailUpdateValues.push(hasUniform ? 1 : 0);
      }

      if (includesCar) {
        detailUpdateFields.push("has_car = ?");
        detailUpdateValues.push(hasCar ? 1 : 0);
      }

      await connection.execute<ResultSetHeader>(
        `
          UPDATE employee_details
          SET ${detailUpdateFields.join(", ")}
          WHERE user_id = ?
        `,
        [...detailUpdateValues, userId],
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Datele angajatului au fost actualizate.",
    });
  } catch (error) {
    await connection.rollback();

    console.error("Update employee error:", error);

    return res.status(500).json({
      success: false,
      message: "Datele angajatului nu au putut fi actualizate.",
    });
  } finally {
    connection.release();
  }
});

/*
|--------------------------------------------------------------------------
| POST /users
|--------------------------------------------------------------------------
*/

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

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Parola este obligatorie.",
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
        SELECT
          id
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

    const [roles] = await db.execute<RoleRow[]>(
      `
        SELECT
          id,
          name
        FROM user_roles
        WHERE name = ?
        LIMIT 1
      `,
      [normalizedRole],
    );

    const selectedRole = roles[0];

    if (!selectedRole) {
      return res.status(400).json({
        success: false,
        message: "Rolul selectat nu există în baza de date.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute<ResultSetHeader>(
      `
        INSERT INTO users (
          username,
          password_hash,
          user_role_id,
          is_active
        )
        VALUES (?, ?, ?, 1)
      `,
      [normalizedUsername, passwordHash, selectedRole.id],
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
