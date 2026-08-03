import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { type ResultSetHeader, type RowDataPacket } from "mysql2";

import { db } from "../db";

const router = Router();

/*
|--------------------------------------------------------------------------
| Image configuration
|--------------------------------------------------------------------------
*/

const NOTIFICATION_IMAGES_DIRECTORY = path.join(
  process.cwd(),
  "public",
  "notification-images",
);

const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const NOTIFICATION_IMAGE_COUNT = 4;

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

interface NotificationImage {
  id: number;
  image_path: string;
  position: number;
}

interface NotificationImageRow extends RowDataPacket {
  id: number;
  notification_id: number;
  image_path: string;
  position: number;
  created_at: Date;
}

interface NotificationRow extends RowDataPacket {
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

interface NotificationWithImages extends NotificationRow {
  images: NotificationImage[];
}

interface RecipientRow extends RowDataPacket {
  id: number;
  username: string;
  user_role: string;
}

interface CountRow extends RowDataPacket {
  unread_count: number;
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
| Validation helpers
|--------------------------------------------------------------------------
*/

function parsePositiveInteger(value: unknown): number | null {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function validateTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const title = value.trim();

  if (title.length === 0 || title.length > 150) {
    return null;
  }

  return title;
}

function validateMessage(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const message = value.trim();

  if (message.length === 0) {
    return null;
  }

  return message;
}

/*
|--------------------------------------------------------------------------
| Image helpers
|--------------------------------------------------------------------------
*/

async function selectRandomNotificationImages(): Promise<string[]> {
  const directoryEntries = await readdir(NOTIFICATION_IMAGES_DIRECTORY, {
    withFileTypes: true,
  });

  const imageFiles = directoryEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => {
      const extension = path.extname(fileName).toLowerCase();

      return ALLOWED_IMAGE_EXTENSIONS.has(extension);
    });

  if (imageFiles.length < NOTIFICATION_IMAGE_COUNT) {
    throw new Error(
      `Folderul public/notification-images trebuie să conțină minimum ${NOTIFICATION_IMAGE_COUNT} imagini valide.`,
    );
  }

  const shuffledImages = [...imageFiles];

  for (
    let currentIndex = shuffledImages.length - 1;
    currentIndex > 0;
    currentIndex -= 1
  ) {
    const randomIndex = Math.floor(Math.random() * (currentIndex + 1));

    [shuffledImages[currentIndex], shuffledImages[randomIndex]] = [
      shuffledImages[randomIndex],
      shuffledImages[currentIndex],
    ];
  }

  return shuffledImages
    .slice(0, NOTIFICATION_IMAGE_COUNT)
    .map((fileName) => `/notification-images/${encodeURIComponent(fileName)}`);
}

async function attachImagesToNotifications(
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

/*
|--------------------------------------------------------------------------
| GET /api/notifications/recipients
|--------------------------------------------------------------------------
|
| Doar ADMIN.
| Returnează utilizatorii activi care pot primi notificări.
|
*/

router.get(
  "/recipients",
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const [recipients] = await db.execute<RecipientRow[]>(
        `
          SELECT
            id,
            username,
            user_role
          FROM users
          WHERE is_active = 1
            AND user_role <> 'ADMIN'
          ORDER BY username ASC
        `,
      );

      return res.status(200).json({
        success: true,
        recipients,
      });
    } catch (error) {
      console.error("❌ Failed to get notification recipients:", error);

      return res.status(500).json({
        success: false,
        message: "Angajații nu au putut fi încărcați.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| GET /api/notifications/unread-count
|--------------------------------------------------------------------------
*/

router.get(
  "/unread-count",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const sessionUser = getSessionUser(req)!;

      const [rows] = await db.execute<CountRow[]>(
        `
          SELECT COUNT(*) AS unread_count
          FROM notifications
          WHERE recipient_id = ?
            AND is_read = 0
        `,
        [sessionUser.id],
      );

      return res.status(200).json({
        success: true,
        unreadCount: Number(rows[0]?.unread_count ?? 0),
      });
    } catch (error) {
      console.error("❌ Failed to get unread notification count:", error);

      return res.status(500).json({
        success: false,
        message: "Numărul notificărilor necitite nu a putut fi încărcat.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| GET /api/notifications
|--------------------------------------------------------------------------
|
| ADMIN vede notificările create de el.
| Restul utilizatorilor văd notificările primite.
|
*/

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionUser = getSessionUser(req)!;

    if (sessionUser.role === "ADMIN") {
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
        [sessionUser.id],
      );

      const notificationsWithImages =
        await attachImagesToNotifications(notifications);

      return res.status(200).json({
        success: true,
        notifications: notificationsWithImages,
      });
    }

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
      [sessionUser.id],
    );

    const notificationsWithImages =
      await attachImagesToNotifications(notifications);

    return res.status(200).json({
      success: true,
      notifications: notificationsWithImages,
    });
  } catch (error) {
    console.error("❌ Failed to get notifications:", error);

    return res.status(500).json({
      success: false,
      message: "Notificările nu au putut fi încărcate.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/notifications
|--------------------------------------------------------------------------
|
| Body:
|
| {
|   "recipientId": 2,
|   "title": "Titlu",
|   "message": "Mesaj",
|   "includeImages": true
| }
|
*/

router.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const recipientId = parsePositiveInteger(req.body.recipientId);
    const title = validateTitle(req.body.title);
    const message = validateMessage(req.body.message);
    const includeImages = req.body.includeImages === true;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: "Selectează un destinatar valid.",
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message:
          "Titlul este obligatoriu și poate avea maximum 150 de caractere.",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Mesajul este obligatoriu.",
      });
    }

    const sessionUser = getSessionUser(req)!;

    const [recipients] = await db.execute<RecipientRow[]>(
      `
        SELECT
          id,
          username,
          user_role
        FROM users
        WHERE id = ?
          AND is_active = 1
          AND user_role <> 'ADMIN'
        LIMIT 1
      `,
      [recipientId],
    );

    if (recipients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Destinatarul nu există sau este inactiv.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Select images before opening the transaction
    |--------------------------------------------------------------------------
    */

    const selectedImages = includeImages
      ? await selectRandomNotificationImages()
      : [];

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [insertResult] = await connection.execute<ResultSetHeader>(
        `
            INSERT INTO notifications (
              recipient_id,
              created_by,
              title,
              message
            )
            VALUES (?, ?, ?, ?)
          `,
        [recipientId, sessionUser.id, title, message],
      );

      for (
        let imageIndex = 0;
        imageIndex < selectedImages.length;
        imageIndex += 1
      ) {
        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO notification_images (
              notification_id,
              image_path,
              position
            )
            VALUES (?, ?, ?)
          `,
          [insertResult.insertId, selectedImages[imageIndex], imageIndex + 1],
        );
      }

      await connection.commit();

      const [createdNotifications] = await db.execute<NotificationRow[]>(
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
        [insertResult.insertId],
      );

      const notificationsWithImages =
        await attachImagesToNotifications(createdNotifications);

      return res.status(201).json({
        success: true,
        message: includeImages
          ? "Notificarea și cele 4 imagini au fost trimise."
          : "Notificarea a fost trimisă.",
        notification: notificationsWithImages[0],
      });
    } catch (error) {
      await connection.rollback();

      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("❌ Failed to create notification:", error);

    const errorMessage = error instanceof Error ? error.message : "";

    if (
      errorMessage.includes("public/notification-images trebuie să conțină")
    ) {
      return res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }

    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return res.status(500).json({
        success: false,
        message: "Folderul public/notification-images nu a fost găsit.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Notificarea nu a putut fi trimisă.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /api/notifications/read-all
|--------------------------------------------------------------------------
|
| Ruta specifică trebuie să fie înainte de /:id.
|
*/

router.patch("/read-all", requireAuth, async (req: Request, res: Response) => {
  try {
    const sessionUser = getSessionUser(req)!;

    const [result] = await db.execute<ResultSetHeader>(
      `
          UPDATE notifications
          SET is_read = 1
          WHERE recipient_id = ?
            AND is_read = 0
        `,
      [sessionUser.id],
    );

    return res.status(200).json({
      success: true,
      message: "Toate notificările au fost marcate drept citite.",
      updatedCount: result.affectedRows,
    });
  } catch (error) {
    console.error("❌ Failed to mark all notifications as read:", error);

    return res.status(500).json({
      success: false,
      message: "Notificările nu au putut fi marcate drept citite.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /api/notifications/:id/read
|--------------------------------------------------------------------------
*/

router.patch("/:id/read", requireAuth, async (req: Request, res: Response) => {
  try {
    const notificationId = parsePositiveInteger(req.params.id);

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "ID-ul notificării este invalid.",
      });
    }

    const sessionUser = getSessionUser(req)!;

    const [result] = await db.execute<ResultSetHeader>(
      `
          UPDATE notifications
          SET is_read = 1
          WHERE id = ?
            AND recipient_id = ?
        `,
      [notificationId, sessionUser.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Notificarea nu există sau nu aparține contului tău.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notificarea a fost marcată drept citită.",
    });
  } catch (error) {
    console.error("❌ Failed to mark notification as read:", error);

    return res.status(500).json({
      success: false,
      message: "Notificarea nu a putut fi actualizată.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /api/notifications/:id
|--------------------------------------------------------------------------
|
| Doar administratorul care a creat notificarea o poate modifica.
| Imaginile deja alese nu se modifică.
|
*/

router.patch("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const notificationId = parsePositiveInteger(req.params.id);

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "ID-ul notificării este invalid.",
      });
    }

    const sessionUser = getSessionUser(req)!;

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
      [notificationId, sessionUser.id],
    );

    if (existingNotifications.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notificarea nu există sau nu ai permisiunea să o modifici.",
      });
    }

    const existingNotification = existingNotifications[0];

    const title =
      req.body.title === undefined
        ? existingNotification.title
        : validateTitle(req.body.title);

    const message =
      req.body.message === undefined
        ? existingNotification.message
        : validateMessage(req.body.message);

    if (!title) {
      return res.status(400).json({
        success: false,
        message:
          "Titlul este obligatoriu și poate avea maximum 150 de caractere.",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Mesajul este obligatoriu.",
      });
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
      [title, message, notificationId, sessionUser.id],
    );

    const [updatedNotifications] = await db.execute<NotificationRow[]>(
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
      await attachImagesToNotifications(updatedNotifications);

    return res.status(200).json({
      success: true,
      message: "Notificarea a fost actualizată.",
      notification: notificationsWithImages[0],
    });
  } catch (error) {
    console.error("❌ Failed to update notification:", error);

    return res.status(500).json({
      success: false,
      message: "Notificarea nu a putut fi actualizată.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE /api/notifications/:id
|--------------------------------------------------------------------------
|
| Imaginile asociate se șterg automat din notification_images prin
| ON DELETE CASCADE.
|
*/

router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const notificationId = parsePositiveInteger(req.params.id);

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "ID-ul notificării este invalid.",
      });
    }

    const sessionUser = getSessionUser(req)!;

    const [result] = await db.execute<ResultSetHeader>(
      `
          DELETE FROM notifications
          WHERE id = ?
            AND created_by = ?
        `,
      [notificationId, sessionUser.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Notificarea nu există sau nu ai permisiunea să o ștergi.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notificarea a fost ștearsă.",
    });
  } catch (error) {
    console.error("❌ Failed to delete notification:", error);

    return res.status(500).json({
      success: false,
      message: "Notificarea nu a putut fi ștearsă.",
    });
  }
});

export default router;
