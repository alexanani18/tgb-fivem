import fs from "node:fs/promises";
import path from "node:path";

import * as notificationsDatabase from "../database/notifications";

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
    const result = await notificationsDatabase.cleanupExpiredNotifications();

    if (!result) {
      return;
    }

    await Promise.all(
      result.submissionFiles.map((submission) =>
        deleteSubmissionFile(submission.file_path),
      ),
    );

    console.log(
      `🗑️ Au fost șterse ${result.notificationIds.length} notificări expirate.`,
    );
  } catch (error) {
    console.error("❌ Curățarea notificărilor expirate a eșuat:", error);
  } finally {
    cleanupIsRunning = false;
  }
}
