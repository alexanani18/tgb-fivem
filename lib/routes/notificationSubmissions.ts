import fs from "node:fs";
import path from "node:path";

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import multer from "multer";

import { type ResultSetHeader,} from "mysql2";

import { db } from "../db";

import * as notificationSubmissionsDatabase from "../database/notificationImageSubmissions";

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
        await notificationSubmissionsDatabase.notificationImageExists(notificationImageId);

      if (!notificationImage) {
        fs.unlinkSync(req.file.path);

        return res.status(404).json({
          success: false,
          message: "Imaginea nu există.",
        });
      }

      const hasAccess = await notificationSubmissionsDatabase.submissionBelongsToUser(
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

      const activeSubmission =
        await notificationSubmissionsDatabase.getActiveSubmission(
          notificationImageId,
          sessionUser.id,
        );

      if (activeSubmission) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Fișierul nu mai există sau nu a putut fi șters.
        }

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

      const submissionId =
        await notificationSubmissionsDatabase.createSubmission(
          notificationImageId,
          sessionUser.id,
          relativePath,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
        );

      return res.status(201).json({
        success: true,
        message: "Imaginea a fost încărcată și trimisă în review.",

        submission: {
          id: submissionId,
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
      const submissions =
        await notificationSubmissionsDatabase.getPendingSubmissions();

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

    const hasAccess =
      await notificationSubmissionsDatabase.submissionBelongsToUser(
        notificationImageId,
        sessionUser.id,
      );

    if (!hasAccess && sessionUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
      });
    }

    const submissions =
      await notificationSubmissionsDatabase.getSubmissionsByNotificationImageId(
        notificationImageId,
      );

    return res.json({
      success: true,
      submissions,
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

      const submission =
        await notificationSubmissionsDatabase.getSubmissionById(submissionId);

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Dovada nu există.",
        });
      }

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

      const updatedSubmission =
        await notificationSubmissionsDatabase.getSubmissionById(submissionId);

      return res.status(200).json({
        success: true,
        message: "Dovada a fost aprobată.",
        submission: updatedSubmission,
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

      const submission =
        await notificationSubmissionsDatabase.getSubmissionById(submissionId);

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Dovada nu există.",
        });
      }

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

      const affectedRows =
        await notificationSubmissionsDatabase.rejectSubmission(
          submissionId,
          sessionUser.id,
          rejectionReason || null,
        );

      if (affectedRows === 0) {
        return res.status(409).json({
          success: false,
          message: "Dovada a fost deja verificată de alt administrator.",
        });
      }

      const updatedSubmission =
        await notificationSubmissionsDatabase.getSubmissionById(submissionId);

      return res.status(200).json({
        success: true,
        message: "Dovada a fost respinsă.",
        submission: updatedSubmission,
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
