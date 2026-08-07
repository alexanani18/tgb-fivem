import "dotenv/config";

import { db } from "../../lib/db";
import { dropTables, ensureDatabaseExists } from "./utils";

async function main() {
  try {
    console.log("\n==========================================");
    console.log("🗑️ Resetare bază de date");
    console.log("==========================================");

    /*
     * Dacă DB_NAME lipsește complet, o creăm mai întâi.
     * Astfel db:fresh funcționează și pe un setup nou.
     */
    await ensureDatabaseExists();

    const connection = await db.getConnection();

    try {
      await dropTables(connection);
      console.log("\n✅ Toate tabelele aplicației au fost șterse.\n");
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("\n❌ Resetarea bazei de date a eșuat.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

void main();
