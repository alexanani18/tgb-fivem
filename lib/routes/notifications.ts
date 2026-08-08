import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  Router,
  type Request,
  type Response,
} from "express";

import { PublicError } from "../services/publicError";
import * as notificationsDatabase from "../database/notifications";
import { requireAuth } from "../services/requireAuth";
import { requireAdmin } from "../services/requireAdmin";

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


/*
|--------------------------------------------------------------------------
| Session helpers
|--------------------------------------------------------------------------
*/

function getSessionUser(req: Request): SessionUser | undefined {
  return req.session.user as SessionUser | undefined;
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
    throw new PublicError(
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
      const recipients = await notificationsDatabase.getRecipients();

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

      const unreadCount = await notificationsDatabase.getUnreadNotificationsCount(
        sessionUser.id,
      );

      return res.status(200).json({
        success: true,
        unreadCount,
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
      const notifications =
        await notificationsDatabase.getAdminNotifications(sessionUser.id);

      return res.status(200).json({
        success: true,
        notifications,
      });
    }

    const notifications =
      await notificationsDatabase.getUserNotifications(sessionUser.id);

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

    const recipient =
      await notificationsDatabase.getRecipientById(recipientId);

    if (!recipient) {
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
    const notification = await notificationsDatabase.createNotification(
      recipientId,
      sessionUser.id,
      title,
      message,
      selectedImages,
    );

    return res.status(201).json({
      success: true,
      message: includeImages
        ? "Notificarea și cele 4 imagini au fost trimise."
        : "Notificarea a fost trimisă.",
      notification,
    });
  } catch (error) {
    console.error("❌ Failed to create notification:", error);

    if (error instanceof PublicError) {
      return res.status(400).json({
        success: false,
        message: error.message,
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

    const updatedCount =
      await notificationsDatabase.markAllNotificationsAsRead(sessionUser.id);

    return res.status(200).json({
      success: true,
      message: "Toate notificările au fost marcate drept citite.",
      updatedCount,
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

    const updated = await notificationsDatabase.markNotificationAsRead(
      notificationId,
      sessionUser.id,
    );

    if (!updated) {
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

    const existingNotification =
      await notificationsDatabase.getNotificationById(notificationId);

    if (
      !existingNotification ||
      existingNotification.created_by !== sessionUser.id
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Notificarea nu există sau nu ai permisiunea să o modifici.",
      });
    }

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

    const notification = await notificationsDatabase.updateNotification(
      notificationId,
      sessionUser.id,
      title,
      message,
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message:
          "Notificarea nu există sau nu ai permisiunea să o modifici.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notificarea a fost actualizată.",
      notification,
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

    const deleted = await notificationsDatabase.deleteNotification(
      notificationId,
      sessionUser.id,
    );

    if (!deleted) {
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