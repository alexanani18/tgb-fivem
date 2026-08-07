import type { RowDataPacket, ResultSetHeader } from "mysql2";

import { db } from "../db";

export interface NotificationImageRow extends RowDataPacket {
    id: number;
    notification_id: number;
    image_path: string;
    position: number;
    display_name: string;
}

export interface ActiveSubmissionRow extends RowDataPacket {
    id: number;
    status: string;
}

export interface SubmissionRow extends RowDataPacket {
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

export async function notificationImageExists(
    notificationImageId: number,
): Promise<NotificationImageRow | null> {
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

export async function submissionBelongsToUser(
    notificationImageId: number,
    userId: number,
): Promise<boolean> {
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

export async function getActiveSubmission(
    notificationImageId: number,
    userId: number,
): Promise<ActiveSubmissionRow | null> {
    const [rows] = await db.execute<ActiveSubmissionRow[]>(
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
        [notificationImageId, userId],
    );

    return rows[0] ?? null;
}

export async function createSubmission(
    notificationImageId: number,
    uploadedBy: number,
    relativePath: string,
    originalFileName: string,
    mimeType: string,
    fileSize: number,
): Promise<number> {
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
            uploadedBy,
            relativePath,
            originalFileName,
            mimeType,
            fileSize,
        ],
    );

    return result.insertId;
}

export interface PendingSubmissionRow extends RowDataPacket {
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

export async function getPendingSubmissions(): Promise<
    PendingSubmissionRow[]
> {
    const [rows] = await db.execute<PendingSubmissionRow[]>(
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

    return rows;
}

export async function getSubmissionsByNotificationImageId(
  notificationImageId: number,
): Promise<SubmissionRow[]> {
  const [rows] = await db.execute<SubmissionRow[]>(
    `
      SELECT *
      FROM notification_image_submissions
      WHERE notification_image_id = ?
      ORDER BY created_at DESC
    `,
    [notificationImageId],
  );

  return rows;
}

export async function getSubmissionById(
  submissionId: number,
): Promise<SubmissionRow | null> {
  const [rows] = await db.execute<SubmissionRow[]>(
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

  return rows[0] ?? null;
}

export async function rejectSubmission(
  submissionId: number,
  reviewedBy: number,
  rejectionReason: string | null,
): Promise<number> {
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
    [reviewedBy, rejectionReason, submissionId],
  );

  return result.affectedRows;
}