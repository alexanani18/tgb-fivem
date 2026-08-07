import "dotenv/config";

import { db } from "../../lib/db";
import { ensureDatabase } from "./utils";

async function main() {
  try {
    await ensureDatabase("startup");
  } catch (error) {
    console.error("\n❌ DB ensure a eșuat. Serverele DEV nu vor porni.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

void main();
