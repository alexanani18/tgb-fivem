import { Router } from "express";
import bcrypt from "bcryptjs";
import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import {
  createUser,
  getRoleByName,
  userExists,
  getUserRanks,
  getEmployees,
  getEmployeeById,
  employeeExists,
  ensureEmployeeDetails,
  updateEmployeeDetails,
  userRankExists,
  updateUser,
} from "../database/users";
import type {
  ContractStatus,
  EmployeeStatus,
  UserRole,
} from "../types/users";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import ExcelJS from "exceljs";
import * as usersDatabase from "../database/users";
import { db } from "../db";
import { requireAdmin } from "../services/requireAdmin";

const router = Router();
interface EmployeeContractExistsRow extends RowDataPacket {
  id: number;
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

/*
|--------------------------------------------------------------------------
| GET /users
|--------------------------------------------------------------------------
*/

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const users = await getEmployees();

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
| GET /users/export/excel
|--------------------------------------------------------------------------
|
| Exportă tabelul angajaților în format Excel.
| Doar ADMIN.
|
*/

router.get("/export/excel", requireAdmin, async (req, res) => {
  try {
    const employees = await usersDatabase.getEmployeesForExcelExport();

    const workbook = new ExcelJS.Workbook();

    const exportedBy = req.session.user?.username ?? "ADMIN";
    const exportDate = new Date();

    workbook.creator = "TGB FiveM Management System";
    workbook.lastModifiedBy = exportedBy;
    workbook.created = exportDate;
    workbook.modified = exportDate;
    workbook.title = "Registru Angajați";
    workbook.subject = "Registrul angajaților Blackfold";
    workbook.company = "The Blackfold Skatehouse";
    workbook.category = "Employee Register";
    workbook.keywords = "Blackfold, Angajați, TGB, FiveM";

    const worksheet = workbook.addWorksheet("Angajați", {
      properties: {
        defaultRowHeight: 20,
      },
      views: [
        {
          state: "frozen",
          ySplit: 6,
          showGridLines: false,
        },
      ],
    });

    /*
    |--------------------------------------------------------------------------
    | Coloane
    |--------------------------------------------------------------------------
    */

    worksheet.columns = [
      { key: "number", width: 8 },
      { key: "fullName", width: 28 },
      { key: "iban", width: 14 },
      { key: "status", width: 14 },
      { key: "phoneNumber", width: 17 },
      { key: "ciSeries", width: 16 },
      { key: "cityHours", width: 11 },
      { key: "rank", width: 27 },
      { key: "meetingAttendance", width: 20 },
      { key: "createdAt", width: 17 },
      { key: "observations", width: 35 },
      { key: "discordId", width: 24 },
      { key: "hasUniform", width: 13 },
      { key: "hasCar", width: 11 },
    ];

    /*
    |--------------------------------------------------------------------------
    | Culori
    |--------------------------------------------------------------------------
    */

    const colors = {
      black: "FF080808",
      darkBlack: "FF000000",
      gold: "FFB8904D",
      lightGold: "FFD8B979",
      white: "FFFFFFFF",
      headerPink: "FFF3B2B2",
      border: "FF727272",
      manager: "FF0A0A0A",
      specialist: "FF142B50",
      crew: "FF8B3307",
      noRank: "FF444444",
      green: "FF2F8F46",
      blue: "FF3477B8",
      red: "FFC83B3B",
      lightRow: "FFF7F7F7",
      alternateRow: "FFEFEFEF",
    };

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: {
        style: "thin",
        color: { argb: colors.border },
      },
      left: {
        style: "thin",
        color: { argb: colors.border },
      },
      bottom: {
        style: "thin",
        color: { argb: colors.border },
      },
      right: {
        style: "thin",
        color: { argb: colors.border },
      },
    };

    /*
    |--------------------------------------------------------------------------
    | Fundal zona de titlu
    |--------------------------------------------------------------------------
    */

    for (let rowNumber = 1; rowNumber <= 4; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      for (let columnNumber = 1; columnNumber <= 14; columnNumber += 1) {
        const cell = row.getCell(columnNumber);

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: colors.darkBlack,
          },
        };
      }
    }

    worksheet.getRow(1).height = 28;
    worksheet.getRow(2).height = 28;
    worksheet.getRow(3).height = 28;
    worksheet.getRow(4).height = 25;

    /*
    |--------------------------------------------------------------------------
    | Titlu stânga
    |--------------------------------------------------------------------------
    */

    worksheet.mergeCells("A1:J3");

    const titleCell = worksheet.getCell("A1");

    titleCell.value = "THE BLACKFOLD SKATEHOUSE";

    titleCell.font = {
      name: "Arial",
      size: 24,
      bold: true,
      color: {
        argb: colors.lightGold,
      },
    };

    titleCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    /*
    |--------------------------------------------------------------------------
    | Informații export dreapta
    |--------------------------------------------------------------------------
    */

    worksheet.mergeCells("K1:L1");
    worksheet.mergeCells("M1:N1");

    worksheet.mergeCells("K2:L2");
    worksheet.mergeCells("M2:N2");

    worksheet.mergeCells("K3:N3");

    const exportDateLabelCell = worksheet.getCell("K1");
    const exportDateValueCell = worksheet.getCell("M1");

    exportDateLabelCell.value = "DATA EXPORTULUI:";
    exportDateValueCell.value = exportDate;
    exportDateValueCell.numFmt = "dd.mm.yyyy hh:mm";

    const exportedByLabelCell = worksheet.getCell("K2");
    const exportedByValueCell = worksheet.getCell("M2");

    exportedByLabelCell.value = "EXPORTAT DE:";
    exportedByValueCell.value = exportedBy;

    const reportTypeCell = worksheet.getCell("K3");

    reportTypeCell.value = "REGISTRU ANGAJAȚI";

    for (const cell of [exportDateLabelCell, exportedByLabelCell]) {
      cell.font = {
        name: "Arial",
        size: 9,
        bold: true,
        color: {
          argb: colors.lightGold,
        },
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "right",
      };
    }

    for (const cell of [exportDateValueCell, exportedByValueCell]) {
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: {
          argb: colors.white,
        },
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "left",
      };
    }

    reportTypeCell.font = {
      name: "Arial",
      size: 9,
      bold: true,
      color: {
        argb: colors.white,
      },
    };

    reportTypeCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    /*
    |--------------------------------------------------------------------------
    | Subtitlu
    |--------------------------------------------------------------------------
    */

    worksheet.mergeCells("A4:N4");

    const subtitleCell = worksheet.getCell("A4");

    subtitleCell.value = "LISTA ANGAJAȚILOR";

    subtitleCell.font = {
      name: "Arial",
      size: 13,
      bold: true,
      color: {
        argb: colors.white,
      },
    };

    subtitleCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    /*
    |--------------------------------------------------------------------------
    | Spațiu între titlu și tabel
    |--------------------------------------------------------------------------
    */

    worksheet.getRow(5).height = 8;

    for (let columnNumber = 1; columnNumber <= 14; columnNumber += 1) {
      worksheet.getRow(5).getCell(columnNumber).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: colors.darkBlack,
        },
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Header tabel
    |--------------------------------------------------------------------------
    */

    const headerRow = worksheet.getRow(6);

    headerRow.values = [
      "Nr. CRT",
      "Nume Prenume",
      "IBAN",
      "Status",
      "Nr. Telefon",
      "Serie CI",
      "Luni",
      "Grad",
      "Prezență Ședință",
      "Data angajării",
      "Observații",
      "ID Discord",
      "Uniformă",
      "Mașină",
    ];

    headerRow.height = 34;

    headerRow.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: {
          argb: colors.black,
        },
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: colors.headerPink,
        },
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };

      cell.border = thinBorder;
    });

    worksheet.autoFilter = {
      from: "A6",
      to: "N6",
    };

    /*
    |--------------------------------------------------------------------------
    | Grupare după grad
    |--------------------------------------------------------------------------
    */

    const rankGroups = [
      {
        name: "Blackfold Manager",
        title: "BLACKFOLD MANAGER",
        fill: colors.manager,
      },
      {
        name: "Blackfold Specialist",
        title: "BLACKFOLD SPECIALIST",
        fill: colors.specialist,
      },
      {
        name: "Blackfold Crew",
        title: "BLACKFOLD CREW",
        fill: colors.crew,
      },
      {
        name: "Fără grad",
        title: "FĂRĂ GRAD",
        fill: colors.noRank,
      },
    ];

    let currentRowNumber = 7;
    let globalEmployeeNumber = 1;
    let dataRowNumber = 0;

    for (const group of rankGroups) {
      const groupEmployees = employees.filter(
        (employee) => (employee.employee_rank ?? "Fără grad") === group.name,
      );

      if (groupEmployees.length === 0) {
        continue;
      }

      worksheet.mergeCells(`A${currentRowNumber}:N${currentRowNumber}`);

      const groupCell = worksheet.getCell(`A${currentRowNumber}`);

      groupCell.value = `${group.title} (${groupEmployees.length})`;

      groupCell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: {
          argb: colors.white,
        },
      };

      groupCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: group.fill,
        },
      };

      groupCell.alignment = {
        vertical: "middle",
        horizontal: "left",
        indent: 1,
      };

      groupCell.border = thinBorder;

      worksheet.getRow(currentRowNumber).height = 25;

      currentRowNumber += 1;

      for (const employee of groupEmployees) {
        const status = employee.employee_status ?? "ACTIV";

        const row = worksheet.getRow(currentRowNumber);

        row.values = [
          globalEmployeeNumber,
          `${employee.first_name} ${employee.last_name}`.trim(),
          employee.iban ?? "—",
          status,
          employee.phone_number ?? "—",
          employee.ci_series ?? "—",
          employee.city_hours ?? "—",
          employee.employee_rank ?? "Fără grad",
          employee.meeting_attendance ? "✓" : "✕",
          employee.created_at,
          employee.observations ?? "",
          employee.discord_id ?? "—",
          employee.has_uniform ? "✓" : "✕",
          employee.has_car ? "✓" : "✕",
        ];

        row.height = 24;

        const rowFill =
          dataRowNumber % 2 === 0 ? colors.lightRow : colors.alternateRow;

        row.eachCell((cell, columnNumber) => {
          cell.font = {
            name: "Arial",
            size: 10,
            color: {
              argb: colors.black,
            },
          };

          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: rowFill,
            },
          };

          cell.border = thinBorder;

          cell.alignment = {
            vertical: "middle",
            horizontal:
              columnNumber === 2 || columnNumber === 11 ? "left" : "center",
            wrapText: columnNumber === 11,
          };
        });

        /*
        |--------------------------------------------------------------------------
        | Status
        |--------------------------------------------------------------------------
        */

        const statusCell = row.getCell(4);

        let statusColor = colors.green;

        if (status === "CONCEDIU") {
          statusColor = colors.blue;
        }

        if (status === "DEMISIONAT") {
          statusColor = colors.red;
        }

        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: statusColor,
          },
        };

        statusCell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: {
            argb: colors.white,
          },
        };

        /*
        |--------------------------------------------------------------------------
        | Prezență / Uniformă / Mașină
        |--------------------------------------------------------------------------
        */

        for (const columnNumber of [9, 13, 14]) {
          const booleanCell = row.getCell(columnNumber);

          const isChecked = booleanCell.value === "✓";

          booleanCell.font = {
            name: "Arial",
            size: 14,
            bold: true,
            color: {
              argb: isChecked ? colors.green : colors.red,
            },
          };

          booleanCell.alignment = {
            vertical: "middle",
            horizontal: "center",
          };
        }

        row.getCell(10).numFmt = "dd.mm.yyyy";

        globalEmployeeNumber += 1;
        currentRowNumber += 1;
        dataRowNumber += 1;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Rezumat final
    |--------------------------------------------------------------------------
    */

    const managerCount = employees.filter(
      (employee) => employee.employee_rank === "Blackfold Manager",
    ).length;

    const specialistCount = employees.filter(
      (employee) => employee.employee_rank === "Blackfold Specialist",
    ).length;

    const crewCount = employees.filter(
      (employee) => employee.employee_rank === "Blackfold Crew",
    ).length;

    const meetingAttendanceCount = employees.filter((employee) =>
      Boolean(employee.meeting_attendance),
    ).length;

    const uniformCount = employees.filter((employee) =>
      Boolean(employee.has_uniform),
    ).length;

    const carCount = employees.filter((employee) =>
      Boolean(employee.has_car),
    ).length;

    currentRowNumber += 1;

    worksheet.mergeCells(`A${currentRowNumber}:N${currentRowNumber + 2}`);

    const summaryCell = worksheet.getCell(`A${currentRowNumber}`);

    summaryCell.value =
      `TOTAL ANGAJAȚI: ${employees.length}     |     ` +
      `MANAGERI: ${managerCount}     |     ` +
      `SPECIALIȘTI: ${specialistCount}     |     ` +
      `CREW: ${crewCount}\n` +
      `PREZENȚĂ ȘEDINȚĂ: ${meetingAttendanceCount}     |     ` +
      `UNIFORMĂ: ${uniformCount}     |     ` +
      `MAȘINĂ: ${carCount}     |     ` +
      `✓ = DA     ✕ = NU`;

    summaryCell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: {
        argb: colors.lightGold,
      },
    };

    summaryCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: colors.darkBlack,
      },
    };

    summaryCell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    summaryCell.border = {
      top: {
        style: "medium",
        color: {
          argb: colors.gold,
        },
      },
      bottom: {
        style: "medium",
        color: {
          argb: colors.gold,
        },
      },
      left: {
        style: "medium",
        color: {
          argb: colors.gold,
        },
      },
      right: {
        style: "medium",
        color: {
          argb: colors.gold,
        },
      },
    };

    worksheet.getRow(currentRowNumber).height = 22;
    worksheet.getRow(currentRowNumber + 1).height = 22;
    worksheet.getRow(currentRowNumber + 2).height = 22;

    /*
    |--------------------------------------------------------------------------
    | Print și footer
    |--------------------------------------------------------------------------
    */

    worksheet.pageSetup = {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    };

    worksheet.pageSetup.printArea = `A1:N${currentRowNumber + 2}`;

    worksheet.headerFooter.oddFooter =
      "&LExport generat din TGB FiveM Management System" +
      "&CThe Blackfold Skatehouse" +
      "&RPagina &P din &N";

    /*
    |--------------------------------------------------------------------------
    | Generare fișier
    |--------------------------------------------------------------------------
    */

    const fileBuffer = await workbook.xlsx.writeBuffer();

    const currentDate = new Intl.DateTimeFormat("en-CA").format(exportDate);

    const fileName = `Angajati-Blackfold-${currentDate}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    res.setHeader("Content-Length", Buffer.byteLength(fileBuffer));

    return res.status(200).send(Buffer.from(fileBuffer));
  } catch (error) {
    console.error("Export employees Excel error:", error);

    return res.status(500).json({
      success: false,
      message: "Fișierul Excel nu a putut fi generat.",
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
    const ranks = await getUserRanks();

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

    const employee = await getEmployeeById(userId);

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

      const contract = await usersDatabase.getEmployeeIdentityContract(userId);

      if (!contract) {
        fs.unlinkSync(req.file.path);

        return res.status(404).json({
          success: false,
          message: "Contractul angajatului nu a fost găsit.",
        });
      }

      const newRelativePath = `/contract-images/${userId}/${req.file.filename}`;

      await usersDatabase.updateEmployeeIdentityImage(
        userId,
        newRelativePath,
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

    await updateEmployeeDetails(connection, userId, {
      meetingAttendance,
      hasUniform,
      hasCar,
    });

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
      const rankExists = await userRankExists(
        connection,
        normalizedRankId,
      );

      if (!rankExists) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: "Gradul selectat nu există.",
        });
      }
    }

    await updateUser(connection, userId, {
      ...(includesRank && normalizedRankId
        ? { rankId: normalizedRankId }
        : {}),
      ...(includesIsActive ? { isActive } : {}),
    });

    const mustUpdateEmployeeDetails =
      includesStatus ||
      includesDiscordId ||
      includesObservations ||
      includesMeetingAttendance ||
      includesUniform ||
      includesCar;

    if (mustUpdateEmployeeDetails) {
      await ensureEmployeeDetails(connection, userId);

      await updateEmployeeDetails(connection, userId, {
        ...(includesStatus && normalizedStatus
          ? { status: normalizedStatus }
          : {}),

        ...(includesDiscordId
          ? { discordId: normalizedDiscordId ?? null }
          : {}),

        ...(includesObservations
          ? { observations: normalizedObservations ?? null }
          : {}),

        ...(includesMeetingAttendance
          ? { meetingAttendance }
          : {}),

        ...(includesUniform
          ? { hasUniform }
          : {}),

        ...(includesCar
          ? { hasCar }
          : {}),
      });
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

    const exists = await userExists(normalizedUsername);

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Există deja un utilizator cu acest username.",
      });
    }

    const selectedRole = await getRoleByName(normalizedRole);

    if (!selectedRole) {
      return res.status(400).json({
        success: false,
        message: "Rolul selectat nu există în baza de date.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userId = await createUser({
      username: normalizedUsername,
      passwordHash,
      roleId: selectedRole.id,
    });

    return res.status(201).json({
      success: true,
      message: "Utilizatorul a fost creat cu succes.",

      user: {
        id: userId,
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
