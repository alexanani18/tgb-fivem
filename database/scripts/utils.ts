import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { db } from "../../lib/db";

type EnsureMode = "install" | "startup";

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface ExistsRow extends RowDataPacket {
  found: number | string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variabila ${name} nu este setată în .env.`);
  }

  return value;
}

function getDatabaseConfig() {
  const port = Number(process.env.DB_PORT || 3306);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("DB_PORT din .env nu este valid.");
  }

  return {
    host: getRequiredEnv("DB_HOST"),
    port,
    user: getRequiredEnv("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    database: getRequiredEnv("DB_NAME"),
  };
}

function escapeIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

/*
|--------------------------------------------------------------------------
| Database bootstrap
|--------------------------------------------------------------------------
|
| Se conectează mai întâi la serverul MySQL FĂRĂ să selecteze o bază.
| Astfel, npm run dev:all funcționează și dacă DB_NAME nu există încă.
|
*/

export async function ensureDatabaseExists(): Promise<string> {
  const config = getDatabaseConfig();

  console.log(`🔌 MySQL: ${config.host}:${config.port}`);
  console.log(`🗄️  Database: ${config.database}`);

  const serverConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    connectTimeout: 10_000,
  });

  try {
    const [rows] = await serverConnection.execute<ExistsRow[]>(
      `
        SELECT COUNT(*) AS found
        FROM information_schema.SCHEMATA
        WHERE SCHEMA_NAME = ?
      `,
      [config.database],
    );

    const databaseExists = Number(rows[0]?.found ?? 0) > 0;

    if (databaseExists) {
      console.log("✅ Baza de date există.");
      return config.database;
    }

    console.log("➕ Baza de date nu există. Se creează...");

    await serverConnection.query(
      `CREATE DATABASE ${escapeIdentifier(config.database)}
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci`,
    );

    console.log("✅ Baza de date a fost creată.");

    return config.database;
  } finally {
    await serverConnection.end();
  }
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

async function tableExists(
  connection: PoolConnection,
  tableName: string,
): Promise<boolean> {
  const [rows] = await connection.execute<ExistsRow[]>(
    `
      SELECT COUNT(*) AS found
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName],
  );

  return Number(rows[0]?.found ?? 0) > 0;
}

async function addColumnIfMissing(
  connection: PoolConnection,
  tableName: string,
  columnName: string,
  definition: string,
): Promise<void> {
  if (!(await tableExists(connection, tableName))) {
    return;
  }

  if (await columnExists(connection, tableName, columnName)) {
    return;
  }

  console.log(`   ➕ ${tableName}.${columnName}`);

  await connection.query(
    `ALTER TABLE ${escapeIdentifier(tableName)}
     ADD COLUMN ${escapeIdentifier(columnName)} ${definition}`,
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
    (await tableExists(connection, "notification_images")) &&
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

  if (!(await tableExists(connection, "user_ranks"))) {
    return;
  }

  /*
   * Migrare sigură de la seed-ul vechi cu 3 rank-uri
   * la structura actuală cu 5 rank-uri.
   */
  const [missingLeadershipRows] = await connection.query<CountRow[]>(`
    SELECT COUNT(*) AS total
    FROM user_ranks
    WHERE name IN (
      'Blackfold Chief Executive Officer',
      'Director adjunct'
    )
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

      /*
       * Folosim valori temporare pentru a evita conflicte
       * dacă sort_order este UNIQUE.
       */
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
    console.log(`   ${(await tableExists(connection, table)) ? "✅" : "❌"} ${table}`);
  }
}

export async function ensureDatabase(
  mode: EnsureMode = "startup",
): Promise<void> {
  console.log("");
  console.log("==========================================");
  console.log(
    mode === "install"
      ? "🚀 Instalare / verificare bază de date"
      : "🔎 Verificare bază de date înainte de DEV",
  );
  console.log("==========================================");

  /*
   * IMPORTANT:
   * db din lib/db.ts selectează direct DB_NAME.
   * De aceea DB_NAME trebuie creată înainte de db.getConnection().
   */
  await ensureDatabaseExists();

  const connection = await db.getConnection();

  try {
    console.log("✅ Conectare la baza aplicației reușită.");

    /*
     * CREATE TABLE IF NOT EXISTS creează doar tabelele lipsă.
     * Fișierele de seed sunt idempotente și nu șterg date existente.
     *
     * Nu folosim tranzacție aici: DDL-ul MySQL (CREATE/ALTER TABLE)
     * face implicit commit și nu beneficiază de beginTransaction().
     */
    await executeSqlFiles(connection, "schema");

    await repairLegacySchema(connection);

    await executeSqlFiles(connection, "seed");

    await printDatabaseSummary(connection);

    console.log("\n==========================================");
    console.log("✅ Baza de date este pregătită.");
    console.log("==========================================\n");
  } catch (error) {
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
