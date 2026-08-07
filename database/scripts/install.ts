import "dotenv/config";

import { db } from "../../lib/db";
import { ensureDatabase } from "./utils";

async function main() {
  try {
    await ensureDatabase("install");
  } catch (error) {
    console.error("\n❌ Instalarea/verificarea DB a eșuat.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

void main();
