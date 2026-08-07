import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { db } from "../db";

type SalaryType = "PUBLIC" | "CONFIDENTIAL";

interface RankRow extends RowDataPacket {
    id: number;
    name: string;
    salary: number;
    salary_type: SalaryType;
    sort_order: number;
    users_count: number | string;
}

export interface Rank {
    id: number;
    name: string;
    salary: number;
    salary_type: SalaryType;
    sort_order: number;
    users_count: number;
}

export async function getRanks(): Promise<Rank[]> {
  const [rows] = await db.query<RankRow[]>(
    `
    SELECT
      ur.id,
      ur.name,
      ur.salary,
      ur.salary_type,
      ur.sort_order,
      COUNT(u.id) AS users_count
    FROM user_ranks ur

    LEFT JOIN users u
      ON u.user_rank_id = ur.id

    GROUP BY
      ur.id,
      ur.name,
      ur.salary,
      ur.salary_type,
      ur.sort_order

    ORDER BY
      ur.sort_order ASC,
      ur.name ASC
    `,
  );

  return rows.map((rank) => ({
    id: Number(rank.id),
    name: rank.name,
    salary: Number(rank.salary),
    salary_type: rank.salary_type,
    sort_order: Number(rank.sort_order),
    users_count: Number(rank.users_count),
  }));
}

interface ExistingRankRow extends RowDataPacket {
  id: number;
}

export async function rankExists(
  name: string,
  sortOrder: number,
): Promise<boolean> {
  const [rows] = await db.query<ExistingRankRow[]>(
    `
      SELECT id
      FROM user_ranks
      WHERE LOWER(name) = LOWER(?)
         OR sort_order = ?
      LIMIT 1
    `,
    [name, sortOrder],
  );

  return rows.length > 0;
}

export interface CreateRankData {
  name: string;
  salary: number;
  salaryType: SalaryType;
  sortOrder: number;
}

export async function createRank(
  data: CreateRankData,
): Promise<number> {
  const [result] = await db.execute<ResultSetHeader>(
    `
      INSERT INTO user_ranks (
        name,
        salary,
        salary_type,
        sort_order
      )
      VALUES (?, ?, ?, ?)
    `,
    [
      data.name,
      data.salary,
      data.salaryType,
      data.sortOrder,
    ],
  );

  return result.insertId;
}

interface ExistingRankRow extends RowDataPacket {
  id: number;
}

export async function rankExistsById(
  rankId: number,
): Promise<boolean> {
  const [rows] = await db.query<ExistingRankRow[]>(
    `
      SELECT id
      FROM user_ranks
      WHERE id = ?
      LIMIT 1
    `,
    [rankId],
  );

  return rows.length > 0;
}

export async function rankNameOrSortOrderExists(
  rankId: number,
  name: string,
  sortOrder: number,
): Promise<boolean> {
  const [rows] = await db.query<ExistingRankRow[]>(
    `
      SELECT id
      FROM user_ranks
      WHERE id <> ?
        AND (
          LOWER(name) = LOWER(?)
          OR sort_order = ?
        )
      LIMIT 1
    `,
    [rankId, name, sortOrder],
  );

  return rows.length > 0;
}

export interface UpdateRankData {
  name: string;
  salary: number;
  salaryType: SalaryType;
  sortOrder: number;
}

export async function updateRank(
  rankId: number,
  data: UpdateRankData,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    `
      UPDATE user_ranks
      SET
        name = ?,
        salary = ?,
        salary_type = ?,
        sort_order = ?
      WHERE id = ?
    `,
    [
      data.name,
      data.salary,
      data.salaryType,
      data.sortOrder,
      rankId,
    ],
  );
}

interface CountRow extends RowDataPacket {
  users_count: number | string;
}

export async function countUsersWithRank(
  rankId: number,
): Promise<number> {
  const [rows] = await db.query<CountRow[]>(
    `
      SELECT COUNT(*) AS users_count
      FROM users
      WHERE user_rank_id = ?
    `,
    [rankId],
  );

  return Number(rows[0]?.users_count ?? 0);
}

export async function deleteRank(
  rankId: number,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    `
      DELETE FROM user_ranks
      WHERE id = ?
    `,
    [rankId],
  );
}

export interface RankLookupRow extends RowDataPacket {
  id: number;
  name: string;
  sort_order: number;
}

export async function getRanksForExport(): Promise<RankLookupRow[]> {
  const [rows] = await db.execute<RankLookupRow[]>(
    `
      SELECT
        id,
        name,
        sort_order
      FROM user_ranks
      ORDER BY
        sort_order ASC,
        name ASC
    `,
  );

  return rows;
}