import "dotenv/config";

import { db } from "../../lib/db";
import { ensureDatabase } from "./utils";

async function main() {
  try {
    await ensureDatabase("startup");
  } catch {
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

void main();
