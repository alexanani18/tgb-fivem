import fs from "node:fs";
import path from "node:path";

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import multer from "multer";

import { type ResultSetHeader, type RowDataPacket } from "mysql2";

import { db } from "../db";

const router = Router();

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

interface SessionUser {
  id: number;
  username: string;
  role: string;
}

interface NotificationImageRow extends RowDataPacket {
  id: number;
  notification_id: number;
  image_path: string;
  position: number;
  display_name: string | null;
}

interface SubmissionRow extends RowDataPacket {
  id: number;
  notification_image_id: number;
  uploaded_by: number;

  file_path: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;

  status: string;

  reviewed_by: number | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;

  created_at: Date;
  updated_at: Date;
}

/*
|--------------------------------------------------------------------------
| Session helpers
|--------------------------------------------------------------------------
*/

function getSessionUser(req: Request): SessionUser | undefined {
  return req.session.user as SessionUser | undefined;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUser = getSessionUser(req);

  if (!sessionUser) {
    return res.status(401).json({
      success: false,
      message: "Trebuie să fii autentificat.",
    });
  }

  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionUser = getSessionUser(req);

  if (!sessionUser) {
    return res.status(401).json({
      success: false,
      message: "Trebuie să fii autentificat.",
    });
  }

  if (sessionUser.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Doar administratorul poate efectua această acțiune.",
    });
  }

  next();
}

/*
|--------------------------------------------------------------------------
| Upload folder
|--------------------------------------------------------------------------
*/

const SUBMISSIONS_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "notification-submissions",
);

if (!fs.existsSync(SUBMISSIONS_DIRECTORY)) {
  fs.mkdirSync(SUBMISSIONS_DIRECTORY, {
    recursive: true,
  });
}

/*
|--------------------------------------------------------------------------
| Multer
|--------------------------------------------------------------------------
*/

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, SUBMISSIONS_DIRECTORY);
  },

  filename(_req, file, callback) {
    const extension = path.extname(file.originalname);

    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}${extension}`;

    callback(null, uniqueName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    if (!allowedExtensions.includes(extension)) {
      callback(
        new Error("Sunt acceptate doar fișiere JPG, JPEG, PNG sau WEBP."),
      );

      return;
    }

    callback(null, true);
  },
});

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function parsePositiveInteger(value: unknown): number | null {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    return null;
  }

  if (parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

async function notificationImageExists(notificationImageId: number) {
  const [rows] = await db.execute<NotificationImageRow[]>(
    `
      SELECT
        id,
        notification_id,
        image_path,
        position,
        display_name
      FROM notification_images
      WHERE id = ?
      LIMIT 1
      `,
    [notificationImageId],
  );

  return rows[0] ?? null;
}

async function submissionBelongsToUser(
  notificationImageId: number,
  userId: number,
) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `
      SELECT
        ni.id
      FROM notification_images ni

      INNER JOIN notifications n
        ON n.id = ni.notification_id

      WHERE
        ni.id = ?
        AND n.recipient_id = ?

      LIMIT 1
      `,
    [notificationImageId, userId],
  );

  return rows.length > 0;
}

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

const uploadSingleImage = upload.single("image");

/*
|--------------------------------------------------------------------------
| POST /api/notification-submissions/upload
|--------------------------------------------------------------------------
|
| FormData:
|
| image                -> fișier
| notificationImageId  -> ID-ul imaginii cerute
|
*/

router.post(
  "/upload",
  requireAuth,
  uploadSingleImage,
  async (req: Request, res: Response) => {
    try {
      const sessionUser = getSessionUser(req)!;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Nu ai selectat nicio imagine.",
        });
      }

      const notificationImageId = parsePositiveInteger(
        req.body.notificationImageId,
      );

      if (!notificationImageId) {
        fs.unlinkSync(req.file.path);

        return res.status(400).json({
          success: false,
          message: "Imaginea cerută este invalidă.",
        });
      }

      const notificationImage =
        await notificationImageExists(notificationImageId);

      if (!notificationImage) {
        fs.unlinkSync(req.file.path);

        return res.status(404).json({
          success: false,
          message: "Imaginea nu există.",
        });
      }

      const hasAccess = await submissionBelongsToUser(
        notificationImageId,
        sessionUser.id,
      );

      if (!hasAccess) {
        fs.unlinkSync(req.file.path);

        return res.status(403).json({
          success: false,
          message: "Nu poți încărca dovada pentru această imagine.",
        });
      }

      const [activeSubmissions] = await db.execute<
        Array<
          RowDataPacket & {
            id: number;
            status: string;
          }
        >
      >(
        `
    SELECT
      id,
      status
    FROM notification_image_submissions
    WHERE notification_image_id = ?
      AND uploaded_by = ?
      AND status IN ('PENDING', 'APPROVED')
    ORDER BY created_at DESC
    LIMIT 1
  `,
        [notificationImageId, sessionUser.id],
      );

      if (activeSubmissions.length > 0) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Fișierul nu mai există sau nu a putut fi șters.
        }

        const activeSubmission = activeSubmissions[0];

        if (activeSubmission.status === "APPROVED") {
          return res.status(409).json({
            success: false,
            message:
              "Această imagine a fost deja aprobată. Nu mai poți încărca alte dovezi.",
          });
        }

        return res.status(409).json({
          success: false,
          message: "Există deja o dovadă în review pentru această imagine.",
        });
      }

      const relativePath = "/notification-submissions/" + req.file.filename;

      const [result] = await db.execute<ResultSetHeader>(
        `
          INSERT INTO notification_image_submissions
          (
            notification_image_id,
            uploaded_by,
            file_path,
            original_file_name,
            mime_type,
            file_size,
            status
          )
          VALUES
          (?, ?, ?, ?, ?, ?, 'PENDING')
          `,
        [
          notificationImageId,
          sessionUser.id,
          relativePath,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
        ],
      );

      return res.status(201).json({
        success: true,
        message: "Imaginea a fost încărcată și trimisă în review.",

        submission: {
          id: result.insertId,
          notificationImageId,
          status: "PENDING",
          filePath: relativePath,
        },
      });
    } catch (error) {
      console.error(error);

      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          //
        }
      }

      return res.status(500).json({
        success: false,
        message: "Imaginea nu a putut fi încărcată.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| GET /api/notification-submissions/review/pending
|--------------------------------------------------------------------------
|
| Doar ADMIN.
| Returnează toate dovezile care așteaptă verificarea.
|
*/

router.get(
  "/review/pending",
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const [submissions] = await db.execute<
        Array<
          RowDataPacket & {
            id: number;
            notification_image_id: number;
            uploaded_by: number;
            file_path: string;
            original_file_name: string;
            mime_type: string;
            file_size: number;
            status: string;
            reviewed_by: number | null;
            reviewed_at: Date | null;
            rejection_reason: string | null;
            created_at: Date;
            updated_at: Date;

            uploader_username: string;
            requested_image_path: string;
            requested_image_position: number;
            requested_image_display_name: string | null;

            notification_id: number;
            notification_title: string;
            notification_message: string;
          }
        >
      >(
        `
          SELECT
            submission.id,
            submission.notification_image_id,
            submission.uploaded_by,
            submission.file_path,
            submission.original_file_name,
            submission.mime_type,
            submission.file_size,
            submission.status,
            submission.reviewed_by,
            submission.reviewed_at,
            submission.rejection_reason,
            submission.created_at,
            submission.updated_at,

            uploader.username AS uploader_username,

            notification_image.image_path
              AS requested_image_path,

            notification_image.position
              AS requested_image_position,

            notification_image.display_name
              AS requested_image_display_name,

            notification.id AS notification_id,
            notification.title AS notification_title,
            notification.message AS notification_message

          FROM notification_image_submissions submission

          INNER JOIN notification_images notification_image
            ON notification_image.id =
              submission.notification_image_id

          INNER JOIN notifications notification
            ON notification.id =
              notification_image.notification_id

          INNER JOIN users uploader
            ON uploader.id = submission.uploaded_by

          WHERE submission.status = 'PENDING'

          ORDER BY submission.created_at ASC
        `,
      );

      return res.status(200).json({
        success: true,
        submissions,
      });
    } catch (error) {
      console.error("❌ Failed to load pending submissions:", error);

      return res.status(500).json({
        success: false,
        message: "Dovezile aflate în review nu au putut fi încărcate.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| GET /:notificationImageId
|--------------------------------------------------------------------------
*/

router.get("/:notificationImageId", requireAuth, async (req, res) => {
  try {
    const sessionUser = getSessionUser(req)!;

    const notificationImageId = parsePositiveInteger(
      req.params.notificationImageId,
    );

    if (!notificationImageId) {
      return res.status(400).json({
        success: false,
      });
    }

    const hasAccess = await submissionBelongsToUser(
      notificationImageId,
      sessionUser.id,
    );

    if (!hasAccess && sessionUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
      });
    }

    const [rows] = await db.execute<SubmissionRow[]>(
      `
          SELECT *
          FROM notification_image_submissions
          WHERE notification_image_id = ?
          ORDER BY created_at DESC
          `,
      [notificationImageId],
    );

    return res.json({
      success: true,
      submissions: rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
    });
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /api/notification-submissions/:submissionId/approve
|--------------------------------------------------------------------------
|
| Doar ADMIN.
|
*/

router.patch(
  "/:submissionId/approve",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const submissionId = parsePositiveInteger(req.params.submissionId);

      if (!submissionId) {
        return res.status(400).json({
          success: false,
          message: "ID-ul dovezii este invalid.",
        });
      }

      const sessionUser = getSessionUser(req)!;

      const [submissions] = await db.execute<SubmissionRow[]>(
        `
          SELECT
            id,
            notification_image_id,
            uploaded_by,
            file_path,
            original_file_name,
            mime_type,
            file_size,
            status,
            reviewed_by,
            reviewed_at,
            rejection_reason,
            created_at,
            updated_at
          FROM notification_image_submissions
          WHERE id = ?
          LIMIT 1
        `,
        [submissionId],
      );

      if (submissions.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Dovada nu există.",
        });
      }

      const submission = submissions[0];

      if (submission.status === "APPROVED") {
        return res.status(409).json({
          success: false,
          message: "Dovada este deja aprobată.",
        });
      }

      if (submission.status === "REJECTED") {
        return res.status(409).json({
          success: false,
          message: "O dovadă respinsă nu mai poate fi aprobată.",
        });
      }

      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [result] = await connection.execute<ResultSetHeader>(
          `
              UPDATE notification_image_submissions
              SET
                status = 'APPROVED',
                reviewed_by = ?,
                reviewed_at = CURRENT_TIMESTAMP,
                rejection_reason = NULL
              WHERE id = ?
                AND status = 'PENDING'
            `,
          [sessionUser.id, submissionId],
        );

        if (result.affectedRows === 0) {
          await connection.rollback();

          return res.status(409).json({
            success: false,
            message: "Dovada a fost deja verificată de alt administrator.",
          });
        }

        /*
        | Din motive de siguranță, orice altă dovadă PENDING pentru aceeași
        | imagine este respinsă automat. În mod normal nu ar trebui să existe,
        | deoarece upload-ul este blocat cât timp există una PENDING.
        */

        await connection.execute<ResultSetHeader>(
          `
            UPDATE notification_image_submissions
            SET
              status = 'REJECTED',
              reviewed_by = ?,
              reviewed_at = CURRENT_TIMESTAMP,
              rejection_reason =
                'O altă dovadă pentru această imagine a fost aprobată.'
            WHERE notification_image_id = ?
              AND id <> ?
              AND status = 'PENDING'
          `,
          [sessionUser.id, submission.notification_image_id, submissionId],
        );

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      const [updatedSubmissions] = await db.execute<SubmissionRow[]>(
        `
            SELECT
              id,
              notification_image_id,
              uploaded_by,
              file_path,
              original_file_name,
              mime_type,
              file_size,
              status,
              reviewed_by,
              reviewed_at,
              rejection_reason,
              created_at,
              updated_at
            FROM notification_image_submissions
            WHERE id = ?
            LIMIT 1
          `,
        [submissionId],
      );

      return res.status(200).json({
        success: true,
        message: "Dovada a fost aprobată.",
        submission: updatedSubmissions[0],
      });
    } catch (error) {
      console.error("❌ Failed to approve submission:", error);

      return res.status(500).json({
        success: false,
        message: "Dovada nu a putut fi aprobată.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| PATCH /api/notification-submissions/:submissionId/reject
|--------------------------------------------------------------------------
|
| Doar ADMIN.
|
| Body:
| {
|   "reason": "Imagine neclară"
| }
|
| Motivul este opțional, dar poate avea maximum 1000 de caractere.
|
*/

router.patch(
  "/:submissionId/reject",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const submissionId = parsePositiveInteger(req.params.submissionId);

      if (!submissionId) {
        return res.status(400).json({
          success: false,
          message: "ID-ul dovezii este invalid.",
        });
      }

      const rawReason = req.body.reason;

      if (rawReason !== undefined && typeof rawReason !== "string") {
        return res.status(400).json({
          success: false,
          message: "Motivul respingerii este invalid.",
        });
      }

      const rejectionReason =
        typeof rawReason === "string" ? rawReason.trim() : "";

      if (rejectionReason.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Motivul respingerii poate avea maximum 1000 de caractere.",
        });
      }

      const sessionUser = getSessionUser(req)!;

      const [submissions] = await db.execute<SubmissionRow[]>(
        `
          SELECT
            id,
            notification_image_id,
            uploaded_by,
            file_path,
            original_file_name,
            mime_type,
            file_size,
            status,
            reviewed_by,
            reviewed_at,
            rejection_reason,
            created_at,
            updated_at
          FROM notification_image_submissions
          WHERE id = ?
          LIMIT 1
        `,
        [submissionId],
      );

      if (submissions.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Dovada nu există.",
        });
      }

      const submission = submissions[0];

      if (submission.status === "REJECTED") {
        return res.status(409).json({
          success: false,
          message: "Dovada este deja respinsă.",
        });
      }

      if (submission.status === "APPROVED") {
        return res.status(409).json({
          success: false,
          message: "O dovadă aprobată nu mai poate fi respinsă.",
        });
      }

      const [result] = await db.execute<ResultSetHeader>(
        `
          UPDATE notification_image_submissions
          SET
            status = 'REJECTED',
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            rejection_reason = ?
          WHERE id = ?
            AND status = 'PENDING'
        `,
        [sessionUser.id, rejectionReason || null, submissionId],
      );

      if (result.affectedRows === 0) {
        return res.status(409).json({
          success: false,
          message: "Dovada a fost deja verificată de alt administrator.",
        });
      }

      const [updatedSubmissions] = await db.execute<SubmissionRow[]>(
        `
            SELECT
              id,
              notification_image_id,
              uploaded_by,
              file_path,
              original_file_name,
              mime_type,
              file_size,
              status,
              reviewed_by,
              reviewed_at,
              rejection_reason,
              created_at,
              updated_at
            FROM notification_image_submissions
            WHERE id = ?
            LIMIT 1
          `,
        [submissionId],
      );

      return res.status(200).json({
        success: true,
        message: "Dovada a fost respinsă.",
        submission: updatedSubmissions[0],
      });
    } catch (error) {
      console.error("❌ Failed to reject submission:", error);

      return res.status(500).json({
        success: false,
        message: "Dovada nu a putut fi respinsă.",
      });
    }
  },
);

export default router;
