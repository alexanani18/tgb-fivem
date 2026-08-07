import fs from "node:fs/promises";
import path from "node:path";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { db } from "../../lib/db";

type EnsureMode = "install" | "startup";

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface ExistsRow extends RowDataPacket {
  found: number | string;
}

async function executeSqlFiles(
  connection: PoolConnection,
  folder: "schema" | "seed",
): Promise<void> {
  const folderPath = path.join(process.cwd(), "database", folder);
  const files = (await fs.readdir(folderPath))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  console.log(`\n📂 ${folder}`);

  for (const file of files) {
    const sql = await fs.readFile(path.join(folderPath, file), "utf8");
    console.log(`   ▶ ${file}`);
    await connection.query(sql);
  }
}

async function columnExists(
  connection: PoolConnection,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const [rows] = await connection.execute<ExistsRow[]>(
    `
      SELECT COUNT(*) AS found
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName],
  );

  return Number(rows[0]?.found ?? 0) > 0;
}

async function indexExists(
  connection: PoolConnection,
  tableName: string,
  indexName: string,
): Promise<boolean> {
  const [rows] = await connection.execute<ExistsRow[]>(
    `
      SELECT COUNT(*) AS found
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName],
  );

  return Number(rows[0]?.found ?? 0) > 0;
}

async function addColumnIfMissing(
  connection: PoolConnection,
  tableName: string,
  columnName: string,
  definition: string,
): Promise<void> {
  if (await columnExists(connection, tableName, columnName)) {
    return;
  }

  console.log(`   ➕ ${tableName}.${columnName}`);
  await connection.query(
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`,
  );
}

async function repairLegacySchema(connection: PoolConnection): Promise<void> {
  console.log("\n🔧 Verificare compatibilitate schemă...");

  await addColumnIfMissing(
    connection,
    "user_ranks",
    "salary",
    "INT NOT NULL DEFAULT 0 AFTER `name`",
  );
  await addColumnIfMissing(
    connection,
    "user_ranks",
    "salary_type",
    "ENUM('PUBLIC','CONFIDENTIAL') NOT NULL DEFAULT 'PUBLIC' AFTER `salary`",
  );

  await addColumnIfMissing(
    connection,
    "employee_contracts",
    "work_schedule",
    "VARCHAR(50) DEFAULT NULL AFTER `approved_at`",
  );
  await addColumnIfMissing(
    connection,
    "employee_contracts",
    "contract_type",
    "ENUM('UNLIMITED','FIXED') DEFAULT NULL AFTER `work_schedule`",
  );
  await addColumnIfMissing(
    connection,
    "employee_contracts",
    "contract_end_date",
    "DATE DEFAULT NULL AFTER `contract_type`",
  );

  if (
    !(await indexExists(
      connection,
      "notification_images",
      "uq_notification_image_position",
    ))
  ) {
    console.log("   ➕ index notification_images(notification_id, position)");
    await connection.query(`
      ALTER TABLE notification_images
      ADD UNIQUE KEY uq_notification_image_position (notification_id, position)
    `);
  }

  // Migrare sigură de la seed-ul vechi cu 3 rank-uri la structura actuală cu 5.
  const [missingLeadershipRows] = await connection.query<CountRow[]>(`
    SELECT COUNT(*) AS total
    FROM user_ranks
    WHERE name IN ('Blackfold Chief Executive Officer', 'Director adjunct')
  `);

  if (Number(missingLeadershipRows[0]?.total ?? 0) < 2) {
    const [legacyRows] = await connection.query<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM user_ranks
      WHERE
        (name = 'Blackfold Manager' AND sort_order = 1)
        OR (name = 'Blackfold Specialist' AND sort_order = 2)
        OR (name = 'Blackfold Crew' AND sort_order = 3)
    `);

    if (Number(legacyRows[0]?.total ?? 0) === 3) {
      console.log("   🔁 Migrare ordine rank-uri 3 → 5");

      await connection.query(`
        UPDATE user_ranks
        SET sort_order = CASE name
          WHEN 'Blackfold Manager' THEN 1003
          WHEN 'Blackfold Specialist' THEN 1004
          WHEN 'Blackfold Crew' THEN 1005
          ELSE sort_order
        END
        WHERE name IN (
          'Blackfold Manager',
          'Blackfold Specialist',
          'Blackfold Crew'
        )
      `);

      await connection.query(`
        UPDATE user_ranks
        SET
          salary = CASE name
            WHEN 'Blackfold Manager' THEN 0
            WHEN 'Blackfold Specialist' THEN 15000
            WHEN 'Blackfold Crew' THEN 10000
            ELSE salary
          END,
          salary_type = CASE name
            WHEN 'Blackfold Manager' THEN 'CONFIDENTIAL'
            ELSE 'PUBLIC'
          END,
          sort_order = CASE name
            WHEN 'Blackfold Manager' THEN 3
            WHEN 'Blackfold Specialist' THEN 4
            WHEN 'Blackfold Crew' THEN 5
            ELSE sort_order
          END
        WHERE name IN (
          'Blackfold Manager',
          'Blackfold Specialist',
          'Blackfold Crew'
        )
      `);
    }
  }
}

async function printDatabaseSummary(connection: PoolConnection): Promise<void> {
  const tables = [
    "user_roles",
    "user_ranks",
    "users",
    "employee_details",
    "employee_contracts",
    "notifications",
    "notification_images",
    "notification_image_submissions",
    "uniforms",
    "discord_roles",
    "employee_discord_roles",
    "employee_documents",
    "employee_document_versions",
  ];

  console.log("\n📋 Tabele verificate:");
  for (const table of tables) {
    const [rows] = await connection.execute<ExistsRow[]>(
      `
        SELECT COUNT(*) AS found
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
      `,
      [table],
    );

    console.log(`   ${Number(rows[0]?.found ?? 0) > 0 ? "✅" : "❌"} ${table}`);
  }
}

export async function ensureDatabase(
  mode: EnsureMode = "startup",
): Promise<void> {
  const connection = await db.getConnection();

  try {
    console.log("");
    console.log("==========================================");
    console.log(
      mode === "install"
        ? "🚀 Instalare / verificare bază de date"
        : "🔎 Verificare bază de date înainte de DEV",
    );
    console.log("==========================================");

    await connection.beginTransaction();

    // CREATE TABLE IF NOT EXISTS: creează doar tabelele lipsă.
    await executeSqlFiles(connection, "schema");

    // Repară automat diferențele cunoscute din bazele vechi.
    await repairLegacySchema(connection);

    // Seed-urile sunt idempotente: adaugă doar valorile standard lipsă.
    await executeSqlFiles(connection, "seed");

    await connection.commit();

    await printDatabaseSummary(connection);

    console.log("\n==========================================");
    console.log("✅ Baza de date este pregătită.");
    console.log("==========================================\n");
  } catch (error) {
    await connection.rollback();

    console.error("\n==========================================");
    console.error("❌ Verificarea bazei de date a eșuat.");
    console.error("==========================================");
    console.error(error);

    throw error;
  } finally {
    connection.release();
  }
}

export async function dropTables(connection: PoolConnection): Promise<void> {
  await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

  try {
    await connection.query(`
      DROP TABLE IF EXISTS employee_document_versions;
      DROP TABLE IF EXISTS employee_documents;
      DROP TABLE IF EXISTS employee_discord_roles;
      DROP TABLE IF EXISTS discord_roles;
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
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
  }
}
