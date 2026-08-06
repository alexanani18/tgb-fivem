import type { RowDataPacket, ResultSetHeader } from "mysql2";

import { db } from "../db";

export type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "DEV" | "GUEST";

export interface AuthUserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  user_role: UserRole;
  is_active: number;
}

async function findUser(
  column: "id" | "username",
  value: number | string,
): Promise<AuthUserRow | null> {
  const [rows] = await db.execute<AuthUserRow[]>(
    `
      SELECT
        u.id,
        u.username,
        u.password_hash,
        ur.name AS user_role,
        u.is_active
      FROM users u
      INNER JOIN user_roles ur
        ON ur.id = u.user_role_id
      WHERE u.${column} = ?
      LIMIT 1
    `,
    [value],
  );

  return rows[0] ?? null;
}

export async function findByUsername(
  username: string,
): Promise<AuthUserRow | null> {
  return findUser("username", username);
}

export async function findById(
  id: number,
): Promise<AuthUserRow | null> {
  return findUser("id", id);
}

export async function updatePassword(
  id: number,
  passwordHash: string,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [passwordHash, id],
  );
}