import fs from "node:fs/promises";
import path from "node:path";

import { type RowDataPacket } from "mysql2";

import { db } from "../db";

interface ExpiredNotificationRow extends RowDataPacket {
  id: number;
}

interface SubmissionFileRow extends RowDataPacket {
  file_path: string;
}

let cleanupIsRunning = false;

async function deleteSubmissionFile(filePath: string): Promise<void> {
  const normalizedPath = filePath.replace(/^[/\\]+/, "");

  const absolutePath = path.join(process.cwd(), "public", normalizedPath);

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code !== "ENOENT") {
      console.error(`❌ Fișierul ${absolutePath} nu a putut fi șters:`, error);
    }
  }
}

export async function cleanupExpiredNotifications(): Promise<void> {
  if (cleanupIsRunning) {
    return;
  }

  cleanupIsRunning = true;

  try {
    /*
    | Notificarea expiră după 24 de ore dacă nu are nicio dovadă
    | PENDING sau APPROVED.
    */

    const [expiredNotifications] = await db.execute<ExpiredNotificationRow[]>(
      `
          SELECT
            notification.id
          FROM notifications notification
          WHERE notification.created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND NOT EXISTS (
              SELECT 1
              FROM notification_images notification_image

              INNER JOIN notification_image_submissions submission
                ON submission.notification_image_id =
                  notification_image.id

              WHERE notification_image.notification_id = notification.id
                AND submission.status IN ('PENDING', 'APPROVED')
            )
        `,
    );

    if (expiredNotifications.length === 0) {
      return;
    }

    const notificationIds = expiredNotifications.map(
      (notification) => notification.id,
    );

    const placeholders = notificationIds.map(() => "?").join(", ");

    const connection = await db.getConnection();

    let submissionFiles: SubmissionFileRow[] = [];

    try {
      await connection.beginTransaction();

      const [fileRows] = await connection.query<SubmissionFileRow[]>(
        `
          SELECT
            submission.file_path
          FROM notification_image_submissions submission

          INNER JOIN notification_images notification_image
            ON notification_image.id =
              submission.notification_image_id

          WHERE notification_image.notification_id
            IN (${placeholders})
        `,
        notificationIds,
      );

      submissionFiles = fileRows;

      /*
      | Ștergem întâi dovezile, apoi imaginile cerute,
      | iar la final notificările.
      */

      await connection.query(
        `
          DELETE submission
          FROM notification_image_submissions submission

          INNER JOIN notification_images notification_image
            ON notification_image.id =
              submission.notification_image_id

          WHERE notification_image.notification_id
            IN (${placeholders})
        `,
        notificationIds,
      );

      await connection.query(
        `
          DELETE FROM notification_images
          WHERE notification_id IN (${placeholders})
        `,
        notificationIds,
      );

      await connection.query(
        `
          DELETE FROM notifications
          WHERE id IN (${placeholders})
        `,
        notificationIds,
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await Promise.all(
      submissionFiles.map((submission) =>
        deleteSubmissionFile(submission.file_path),
      ),
    );

    console.log(
      `🗑️ Au fost șterse ${notificationIds.length} notificări expirate.`,
    );
  } catch (error) {
    console.error("❌ Curățarea notificărilor expirate a eșuat:", error);
  } finally {
    cleanupIsRunning = false;
  }
}
