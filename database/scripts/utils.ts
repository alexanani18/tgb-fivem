import fs from "node:fs/promises";
import path from "node:path";
import { PoolConnection } from "mysql2/promise";
import { db } from "../../lib/db";

export async function executeSqlFiles(
    connection: PoolConnection,
    folder: string,
) {
    const folderPath = path.join(process.cwd(), "database", folder);

    const files = (await fs.readdir(folderPath))
        .filter((file) => file.endsWith(".sql"))
        .sort();

    console.log(`\n📂 ${folder}`);

    for (const file of files) {
        const sql = await fs.readFile(
            path.join(folderPath, file),
            "utf8",
        );

        console.log(`   ▶ ${file}`);

        await connection.query(sql);
    }
}

export async function installDatabase() {
    const connection = await db.getConnection();

    try {
        console.log("");
        console.log("==================================");
        console.log("🚀 Installing database...");
        console.log("==================================");

        await connection.beginTransaction();

        await executeSqlFiles(connection, "schema");

        await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

        await executeSqlFiles(connection, "seed");

        await connection.query("SET FOREIGN_KEY_CHECKS = 1;");

        await connection.commit();

        console.log("");
        console.log("==================================");
        console.log("✅ Database installed successfully.");
        console.log("==================================");
    } catch (error) {
        await connection.rollback();

        console.error("");
        console.error("==================================");
        console.error("❌ Database installation failed.");
        console.error("==================================");

        console.error(error);

        process.exitCode = 1;
    } finally {
        connection.release();
        await db.end();
    }
}
export async function dropTables(
  connection: PoolConnection,
) {
  await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

  await connection.query(`
    DROP TABLE IF EXISTS notification_image_submissions;
    DROP TABLE IF EXISTS notification_images;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS employee_contracts;
    DROP TABLE IF EXISTS employee_details;
    DROP TABLE IF EXISTS uniforms;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS user_ranks;
    DROP TABLE IF EXISTS user_roles;
  `);

  await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
}