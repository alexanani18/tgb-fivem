import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import type {
  ContractStatus,
  EmployeeStatus,
  UserRole,
} from "../types/users";

import { db } from "../db";

interface ExistingUserRow extends RowDataPacket {
  id: number;
}

interface RoleRow extends RowDataPacket {
  id: number;
  name: string;
}

export interface EmployeeUserRow extends RowDataPacket {
  id: number;

  first_name: string;
  last_name: string;

  iban: string | number | null;
  phone_number: string | null;
  ci_series: string | null;
  city_hours: string | number | null;

  employee_rank: string | null;
  employee_status: EmployeeStatus | null;

  meeting_attendance: number | null;
  has_uniform: number | null;
  has_car: number | null;

  observations: string | null;
  discord_id: string | null;

  created_at: Date;
}

/*
|--------------------------------------------------------------------------
| Users
|--------------------------------------------------------------------------
*/

export async function userExists(username: string) {
  const [rows] = await db.execute<ExistingUserRow[]>(
    `
      SELECT
        id
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username],
  );

  return rows.length !== 0;
}

export async function getRoleByName(name: string) {
  const [rows] = await db.execute<RoleRow[]>(
    `
      SELECT
        id,
        name
      FROM user_roles
      WHERE name = ?
      LIMIT 1
    `,
    [name],
  );

  return rows[0] ?? null;
}

interface CreateUserData {
  username: string;
  passwordHash: string;
  roleId: number;
}

export async function createUser(data: CreateUserData) {
  const [result] = await db.execute<ResultSetHeader>(
    `
      INSERT INTO users (
        username,
        password_hash,
        user_role_id,
        is_active
      )
      VALUES (?, ?, ?, 1)
    `,
    [
      data.username,
      data.passwordHash,
      data.roleId,
    ],
  );

  return result.insertId;
}

/*
|--------------------------------------------------------------------------
| User Ranks
|--------------------------------------------------------------------------
*/

interface UserRankRow extends RowDataPacket {
  id: number;
  name: string;
  sort_order: number;
}

export async function getUserRanks() {
  const [rows] = await db.execute<UserRankRow[]>(
    `
      SELECT
        id,
        name,
        sort_order
      FROM user_ranks
      ORDER BY sort_order ASC
    `,
  );

  return rows;
}


/*
|--------------------------------------------------------------------------
| Employees
|--------------------------------------------------------------------------
*/

export async function getEmployees() {
  const [rows] = await db.execute<EmployeeUserRow[]>(
    `
      SELECT
        u.id,

        COALESCE(ec.first_name, u.username) AS first_name,
        COALESCE(ec.last_name, '') AS last_name,

        ec.game_id AS iban,
        ec.phone_number,
        ec.ci_series,
        ec.city_hours,

        rk.name AS employee_rank,

        ed.status AS employee_status,
        ed.meeting_attendance,
        ed.has_uniform,
        ed.has_car,
        ed.observations,
        ed.discord_id,

        u.created_at

      FROM users u

      INNER JOIN user_roles ur
        ON ur.id = u.user_role_id

      LEFT JOIN user_ranks rk
        ON rk.id = u.user_rank_id

      LEFT JOIN employee_contracts ec
        ON ec.user_id = u.id

      LEFT JOIN employee_details ed
        ON ed.user_id = u.id

      WHERE ur.name IN ('ANGAJAT', 'MAFIA', 'ADMIN')
        AND (
          ed.status IS NULL
          OR ed.status <> 'DEMISIONAT'
        )

      ORDER BY
        COALESCE(rk.sort_order, 999) ASC,
        COALESCE(ec.last_name, u.username) ASC,
        COALESCE(ec.first_name, u.username) ASC
    `,
  );

  return rows;
}

/*
|--------------------------------------------------------------------------
| Employee Details
|--------------------------------------------------------------------------
*/

interface EmployeeDetailsRow extends RowDataPacket {
  id: number;
  username: string;
  is_active: number;
  created_at: Date;
  updated_at: Date;

  website_role: UserRole;

  employee_rank_id: number | null;
  employee_rank: string | null;

  first_name: string | null;
  last_name: string | null;
  age: number | null;
  iban: string | number | null;
  ci_series: string | null;
  phone_number: string | null;
  city_hours: string | number | null;
  identity_image_path: string | null;
  employee_signature_name: string | null;

  contract_status: ContractStatus | null;

  signed_at: Date | null;
  approved_by_name: string | null;
  admin_signature_path: string | null;
  approved_at: Date | null;
  rejected_at: Date | null;

  employee_status: EmployeeStatus | null;
  meeting_attendance: number | null;
  has_uniform: number | null;
  has_car: number | null;
  discord_id: string | null;
  observations: string | null;
}

export async function getEmployeeById(userId: number) {
  const [rows] = await db.execute<EmployeeDetailsRow[]>(
    `
      SELECT
        u.id,
        u.username,
        u.is_active,
        u.created_at,
        u.updated_at,

        ur.name AS website_role,

        u.user_rank_id AS employee_rank_id,
        rk.name AS employee_rank,

        ec.first_name,
        ec.last_name,
        ec.age,
        ec.game_id AS iban,
        ec.ci_series,
        ec.phone_number,
        ec.city_hours,
        ec.identity_image_path,
        ec.employee_signature_name,
        ec.status AS contract_status,
        ec.signed_at,
        ec.approved_by_name,
        ec.admin_signature_path,
        ec.approved_at,
        ec.rejected_at,

        ed.status AS employee_status,
        ed.meeting_attendance,
        ed.has_uniform,
        ed.has_car,
        ed.discord_id,
        ed.observations

      FROM users u

      INNER JOIN user_roles ur
        ON ur.id = u.user_role_id

      LEFT JOIN user_ranks rk
        ON rk.id = u.user_rank_id

      LEFT JOIN employee_contracts ec
        ON ec.user_id = u.id

      LEFT JOIN employee_details ed
        ON ed.user_id = u.id

      WHERE u.id = ?
        AND ur.name IN ('ANGAJAT', 'MAFIA', 'ADMIN')

      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}


interface EmployeeExistsRow extends RowDataPacket {
  id: number;
}

export async function employeeExists(
  connection: PoolConnection,
  userId: number,
): Promise<boolean> {
  const [rows] = await connection.execute<EmployeeExistsRow[]>(
    `
      SELECT
        u.id
      FROM users u

      INNER JOIN user_roles ur
        ON ur.id = u.user_role_id

      WHERE u.id = ?
        AND ur.name IN ('ANGAJAT', 'MAFIA', 'ADMIN')

      LIMIT 1
    `,
    [userId],
  );

  return rows.length !== 0;
}


export async function ensureEmployeeDetails(
  connection: PoolConnection,
  userId: number,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO employee_details (
        user_id,
        status,
        meeting_attendance,
        has_uniform,
        has_car
      )
      VALUES (?, 'ACTIV', 0, 0, 0)

      ON DUPLICATE KEY UPDATE
        user_id = ?
    `,
    [userId, userId],
  );
}

interface UpdateEmployeeDetailsData {
  status?: EmployeeStatus;
  discordId?: string | null;
  observations?: string | null;

  meetingAttendance?: boolean;
  hasUniform?: boolean;
  hasCar?: boolean;
}

export async function updateEmployeeDetails(
  connection: PoolConnection,
  userId: number,
  data: UpdateEmployeeDetailsData,
): Promise<void> {
  const updateFields: string[] = [];
  const updateValues: Array<number | string | null> = [];

  if (data.status !== undefined) {
    updateFields.push("status = ?");
    updateValues.push(data.status);
  }

  if (data.discordId !== undefined) {
    updateFields.push("discord_id = ?");
    updateValues.push(data.discordId);
  }

  if (data.observations !== undefined) {
    updateFields.push("observations = ?");
    updateValues.push(data.observations);
  }
  if (data.meetingAttendance !== undefined) {
    updateFields.push("meeting_attendance = ?");
    updateValues.push(data.meetingAttendance ? 1 : 0);
  }

  if (data.hasUniform !== undefined) {
    updateFields.push("has_uniform = ?");
    updateValues.push(data.hasUniform ? 1 : 0);
  }

  if (data.hasCar !== undefined) {
    updateFields.push("has_car = ?");
    updateValues.push(data.hasCar ? 1 : 0);
  }

  if (updateFields.length === 0) {
    return;
  }
  await connection.execute<ResultSetHeader>(
    `
      UPDATE employee_details
      SET ${updateFields.join(", ")}
      WHERE user_id = ?
    `,
    [...updateValues, userId],
  );
}

interface UserRankExistsRow extends RowDataPacket {
  id: number;
}

export async function userRankExists(
  connection: PoolConnection,
  rankId: number,
): Promise<boolean> {
  const [rows] = await connection.execute<UserRankExistsRow[]>(
    `
      SELECT
        id
      FROM user_ranks
      WHERE id = ?
      LIMIT 1
    `,
    [rankId],
  );

  return rows.length !== 0;
}

interface UpdateUserData {
  rankId?: number;
  isActive?: boolean;
}

export async function updateUser(
  connection: PoolConnection,
  userId: number,
  data: UpdateUserData,
): Promise<void> {
  const updateFields: string[] = [];
  const updateValues: Array<number | string | null> = [];

  if (data.rankId !== undefined) {
    updateFields.push("user_rank_id = ?");
    updateValues.push(data.rankId);
  }

  if (data.isActive !== undefined) {
    updateFields.push("is_active = ?");
    updateValues.push(data.isActive ? 1 : 0);
  }

  if (updateFields.length === 0) {
    return;
  }

  await connection.execute<ResultSetHeader>(
    `
      UPDATE users
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `,
    [...updateValues, userId],
  );
}

export async function getEmployeesForExcelExport(): Promise<EmployeeUserRow[]> {
  const [rows] = await db.execute<EmployeeUserRow[]>(
    `
        SELECT
          u.id,

          COALESCE(ec.first_name, u.username) AS first_name,
          COALESCE(ec.last_name, '') AS last_name,

          ec.game_id AS iban,
          ec.phone_number,
          ec.ci_series,
          ec.city_hours,

          rk.name AS employee_rank,

          ed.status AS employee_status,
          ed.meeting_attendance,
          ed.has_uniform,
          ed.has_car,
          ed.observations,
          ed.discord_id,

          u.created_at

        FROM users u

        INNER JOIN user_roles ur
          ON ur.id = u.user_role_id

        LEFT JOIN user_ranks rk
          ON rk.id = u.user_rank_id

        LEFT JOIN employee_contracts ec
          ON ec.user_id = u.id

        LEFT JOIN employee_details ed
          ON ed.user_id = u.id

        WHERE ur.name IN ('ANGAJAT', 'MAFIA', 'ADMIN')
          AND (
            ed.status IS NULL
            OR ed.status <> 'DEMISIONAT'
          )

        ORDER BY
          COALESCE(rk.sort_order, 999) ASC,
          COALESCE(ec.last_name, u.username) ASC,
          COALESCE(ec.first_name, u.username) ASC
      `,
  );

  return rows;
}

interface EmployeeIdentityRow extends RowDataPacket {
  id: number;
  identity_image_path: string | null;
}

export async function getEmployeeIdentityContract(
  userId: number,
): Promise<EmployeeIdentityRow | null> {
  const [rows] = await db.execute<EmployeeIdentityRow[]>(
    `
      SELECT
        id,
        identity_image_path
      FROM employee_contracts
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

export async function updateEmployeeIdentityImage(
  userId: number,
  identityImagePath: string,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    `
      UPDATE employee_contracts
      SET identity_image_path = ?
      WHERE user_id = ?
    `,
    [identityImagePath, userId],
  );
}