import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { type ResultSetHeader, type RowDataPacket } from "mysql2";

import { db } from "../db";

const router = Router();

interface SessionUser {
  id: number;
  username: string;
  role: string;
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

interface RecipientRow extends RowDataPacket {
  id: number;
  username: string;
  user_role: string;
}

interface CountRow extends RowDataPacket {
  unread_count: number;
}

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
| GET /api/notifications/recipients
|--------------------------------------------------------------------------
|
| Doar ADMIN.
| Returnează utilizatorii activi cărora le poate trimite notificări.
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
      console.error("❌ Failed to get unread count:", error);

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
| Restul utilizatorilor văd doar notificările primite.
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

      return res.status(200).json({
        success: true,
        notifications,
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

    return res.status(200).json({
      success: true,
      notifications,
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
| Doar ADMIN.
|
*/

router.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const recipientId = parsePositiveInteger(req.body.recipientId);
    const title = validateTitle(req.body.title);
    const message = validateMessage(req.body.message);

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

    const [result] = await db.execute<ResultSetHeader>(
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
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      message: "Notificarea a fost trimisă.",
      notification: createdNotifications[0],
    });
  } catch (error) {
    console.error("❌ Failed to create notification:", error);

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
| Trebuie definită înainte de /:id.
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
| Doar ADMIN-ul care a creat notificarea.
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

    return res.status(200).json({
      success: true,
      message: "Notificarea a fost actualizată.",
      notification: updatedNotifications[0],
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
