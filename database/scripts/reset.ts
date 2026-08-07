import "dotenv/config";

import { db } from "../../lib/db";
import { dropTables } from "./utils";

async function main() {
  const connection = await db.getConnection();

  try {
    console.log("\n==========================================");
    console.log("🗑️ Resetare bază de date");
    console.log("==========================================");

    await dropTables(connection);

    console.log("\n✅ Toate tabelele aplicației au fost șterse.\n");
  } catch (error) {
    console.error("\n❌ Resetarea bazei de date a eșuat.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await db.end();
  }
}

void main();
