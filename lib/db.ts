import mysql from "mysql2/promise";

const globalForDatabase = globalThis as unknown as {
  _database: mysql.Pool | undefined;
};

export const db =
  globalForDatabase._database ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    multipleStatements: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase._database = db;
}