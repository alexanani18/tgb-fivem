import type { RowDataPacket, ResultSetHeader } from "mysql2";

import { db } from "../db";

export type UserRole = "ADMIN" | "ANGAJAT" | "MAFIA" | "DEV" | "GUEST";

export interface AuthUserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  user_role: UserRole;
  user_rank: string | null;
  first_name: string | null;
  last_name: string | null;
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
        usr.name AS user_rank,
        ec.first_name,
        ec.last_name,
        u.is_active
      FROM users u
      INNER JOIN user_roles ur
        ON ur.id = u.user_role_id
      LEFT JOIN user_ranks usr
        ON usr.id = u.user_rank_id
      LEFT JOIN employee_contracts ec
        ON ec.id = (
          SELECT ec2.id
          FROM employee_contracts ec2
          WHERE ec2.user_id = u.id
          ORDER BY
            CASE
              WHEN ec2.status = 'APPROVED' THEN 0
              WHEN ec2.status = 'PENDING_REVIEW' THEN 1
              WHEN ec2.status = 'DRAFT' THEN 2
              ELSE 3
            END,
            ec2.updated_at DESC,
            ec2.id DESC
          LIMIT 1
        )
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

export async function findById(id: number): Promise<AuthUserRow | null> {
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
