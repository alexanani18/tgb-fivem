import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../db";

export interface NotificationRow extends RowDataPacket {
  id: number;
  recipient_id: number;
  created_by: number;
  title: string;
  message: string;
  is_read: number;
  created_at: Date;
  updated_at: Date;
  recipient_username?: string;
  creator_username?: string;
}
export interface NotificationImage {
  id: number;
  image_path: string;
  position: number;
}

export interface NotificationWithImages extends NotificationRow {
  images: NotificationImage[];
}

export interface NotificationImageRow extends RowDataPacket {
  id: number;
  notification_id: number;
  image_path: string;
  position: number;
  created_at: Date;
}

export interface CountRow extends RowDataPacket {
  unread_count: number;
}

export interface RecipientRow extends RowDataPacket {
  id: number;
  username: string;
  user_role: string;
}

export async function attachImagesToNotifications(
  notifications: NotificationRow[],
): Promise<NotificationWithImages[]> {
  if (notifications.length === 0) {
    return [];
  }

  const notificationIds = notifications.map((notification) => notification.id);

  const placeholders = notificationIds.map(() => "?").join(", ");

  const [imageRows] = await db.execute<NotificationImageRow[]>(
    `
      SELECT
        id,
        notification_id,
        image_path,
        position,
        created_at
      FROM notification_images
      WHERE notification_id IN (${placeholders})
      ORDER BY notification_id ASC, position ASC
    `,
    notificationIds,
  );

  const imagesByNotificationId = new Map<number, NotificationImage[]>();

  for (const imageRow of imageRows) {
    const currentImages =
      imagesByNotificationId.get(imageRow.notification_id) ?? [];

    currentImages.push({
      id: imageRow.id,
      image_path: imageRow.image_path,
      position: imageRow.position,
    });

    imagesByNotificationId.set(imageRow.notification_id, currentImages);
  }

  return notifications.map((notification) => ({
    ...notification,
    images: imagesByNotificationId.get(notification.id) ?? [],
  }));
}

export async function getRecipients(): Promise<RecipientRow[]> {
  const [rows] = await db.execute<RecipientRow[]>(
    `
      SELECT
        u.id,
        u.username,
        ur.name AS user_role
      FROM users u
      INNER JOIN user_roles ur
        ON ur.id = u.user_role_id
      WHERE u.is_active = 1
        AND ur.name <> 'ADMIN'
      ORDER BY u.username ASC
    `,
  );

  return rows;
}

export async function getUnreadNotificationsCount(
  recipientId: number,
): Promise<number> {
  const [rows] = await db.execute<CountRow[]>(
    `
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE recipient_id = ?
        AND is_read = 0
    `,
    [recipientId],
  );

  return Number(rows[0]?.unread_count ?? 0);
}

export async function getAdminNotifications(
  adminUserId: number,
): Promise<NotificationWithImages[]> {
  const [notifications] = await db.execute<NotificationRow[]>(
    `
      SELECT
        n.id,
        n.recipient_id,
        n.created_by,
        n.title,
        n.message,
        n.is_read,
        n.created_at,
        n.updated_at,
        recipient.username AS recipient_username,
        creator.username AS creator_username
      FROM notifications n
      INNER JOIN users recipient
        ON recipient.id = n.recipient_id
      INNER JOIN users creator
        ON creator.id = n.created_by
      WHERE n.created_by = ?
      ORDER BY n.created_at DESC
    `,
    [adminUserId],
  );

  return attachImagesToNotifications(notifications);
}

export async function getUserNotifications(
  userId: number,
): Promise<NotificationWithImages[]> {
  const [notifications] = await db.execute<NotificationRow[]>(
    `
      SELECT
        n.id,
        n.recipient_id,
        n.created_by,
        n.title,
        n.message,
        n.is_read,
        n.created_at,
        n.updated_at,
        creator.username AS creator_username
      FROM notifications n
      INNER JOIN users creator
        ON creator.id = n.created_by
      WHERE n.recipient_id = ?
      ORDER BY n.created_at DESC
    `,
    [userId],
  );

  return attachImagesToNotifications(notifications);
}

export async function getRecipientById(
  recipientId: number,
): Promise<RecipientRow | null> {
  const [rows] = await db.execute<RecipientRow[]>(
    `
      SELECT
        u.id,
        u.username,
        ur.name AS user_role
      FROM users u
      INNER JOIN user_roles ur
        ON ur.id = u.user_role_id
      WHERE u.id = ?
        AND u.is_active = 1
        AND ur.name <> 'ADMIN'
      LIMIT 1
    `,
    [recipientId],
  );

  return rows[0] ?? null;
}

export async function getNotificationById(
  notificationId: number,
): Promise<NotificationWithImages | null> {
  const [notifications] = await db.execute<NotificationRow[]>(
    `
      SELECT
        n.id,
        n.recipient_id,
        n.created_by,
        n.title,
        n.message,
        n.is_read,
        n.created_at,
        n.updated_at,
        recipient.username AS recipient_username,
        creator.username AS creator_username
      FROM notifications n
      INNER JOIN users recipient
        ON recipient.id = n.recipient_id
      INNER JOIN users creator
        ON creator.id = n.created_by
      WHERE n.id = ?
      LIMIT 1
    `,
    [notificationId],
  );

  const notificationsWithImages =
    await attachImagesToNotifications(notifications);

  return notificationsWithImages[0] ?? null;
}

export async function markAllNotificationsAsRead(
  recipientId: number,
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `
      UPDATE notifications
      SET is_read = 1
      WHERE recipient_id = ?
        AND is_read = 0
    `,
    [recipientId],
  );

  return result.affectedRows;
}

export async function markNotificationAsRead(
  notificationId: number,
  recipientId: number,
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `
      UPDATE notifications
      SET is_read = 1
      WHERE id = ?
        AND recipient_id = ?
    `,
    [notificationId, recipientId],
  );

  return result.affectedRows > 0;
}

export async function updateNotification(
  notificationId: number,
  adminUserId: number,
  title: string,
  message: string,
): Promise<NotificationWithImages | null> {
  const [existingNotifications] = await db.execute<NotificationRow[]>(
    `
      SELECT
        id,
        recipient_id,
        created_by,
        title,
        message,
        is_read,
        created_at,
        updated_at
      FROM notifications
      WHERE id = ?
        AND created_by = ?
      LIMIT 1
    `,
    [notificationId, adminUserId],
  );

  if (existingNotifications.length === 0) {
    return null;
  }

  await db.execute<ResultSetHeader>(
    `
      UPDATE notifications
      SET
        title = ?,
        message = ?
      WHERE id = ?
        AND created_by = ?
    `,
    [title, message, notificationId, adminUserId],
  );

  return getNotificationById(notificationId);
}

export async function deleteNotification(
  notificationId: number,
  adminUserId: number,
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `
      DELETE FROM notifications
      WHERE id = ?
        AND created_by = ?
    `,
    [notificationId, adminUserId],
  );

  return result.affectedRows > 0;
}