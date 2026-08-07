import "dotenv/config";

import { db } from "../../lib/db";
import { dropTables } from "./utils";

async function resetDatabase() {
  const connection = await db.getConnection();

  try {
    console.log("");
    console.log("==================================");
    console.log("🗑️ Resetting database...");
    console.log("==================================");

    await dropTables(connection);

    console.log("");
    console.log("==================================");
    console.log("✅ Database reset completed.");
    console.log("==================================");
  } catch (error) {
    console.error("");
    console.error("==================================");
    console.error("❌ Database reset failed.");
    console.error("==================================");

    console.error(error);

    process.exitCode = 1;
  } finally {
    connection.release();
    await db.end();
  }
}

void resetDatabase();