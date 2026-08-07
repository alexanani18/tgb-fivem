import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "../db";
import type { ContractStatus } from "../types/users";

export type ContractType = "UNLIMITED" | "FIXED";

export interface ContractRow extends RowDataPacket {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  age: number;
  game_id: string;
  ci_series: string;
  phone_number: string;
  city_hours: number;
  identity_image_path: string;
  accepted_rules: number;
  employee_signature_name: string | null;
  status: ContractStatus;
  contract_creation_blocked: number;
  signed_at: Date | null;
  approved_by_user_id: number | null;
  approved_by_name: string | null;
  admin_signature_path: string | null;
  approved_at: Date | null;
  work_schedule: string | null;
  contract_type: ContractType | null;
  contract_end_date: Date | string | null;
  created_at: Date;
  updated_at: Date;
  rejected_by_user_id: number | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
}

export async function getOwnContract(
  userId: number,
): Promise<ContractRow | null> {
  const [rows] = await db.execute<ContractRow[]>(
    `
      SELECT
        ec.id,
        ec.user_id,
        ec.first_name,
        ec.last_name,
        ec.age,
        ec.game_id,
        ec.ci_series,
        ec.phone_number,
        ec.city_hours,
        ec.identity_image_path,
        ec.accepted_rules,
        ec.employee_signature_name,
        ec.status,
        ec.contract_creation_blocked,
        ec.signed_at,
        ec.approved_by_user_id,
        COALESCE(
          NULLIF(
            TRIM(CONCAT_WS(' ', approved_contract.last_name, approved_contract.first_name)),
            ''
          ),
          approved_user.username,
          ec.approved_by_name
        ) AS approved_by_name,
        ec.admin_signature_path,
        ec.approved_at,
        ec.work_schedule,
        ec.contract_type,
        ec.contract_end_date,
        ec.rejected_by_user_id,
        COALESCE(
          NULLIF(
            TRIM(CONCAT_WS(' ', rejected_contract.last_name, rejected_contract.first_name)),
            ''
          ),
          rejected_user.username
        ) AS rejected_by_name,
        ec.rejected_at,
        ec.created_at,
        ec.updated_at
      FROM employee_contracts ec
      LEFT JOIN users approved_user
        ON approved_user.id = ec.approved_by_user_id
      LEFT JOIN employee_contracts approved_contract
        ON approved_contract.user_id = ec.approved_by_user_id
      LEFT JOIN users rejected_user
        ON rejected_user.id = ec.rejected_by_user_id
      LEFT JOIN employee_contracts rejected_contract
        ON rejected_contract.user_id = ec.rejected_by_user_id
      WHERE ec.user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

export interface AdminContractListRow extends ContractRow {
  username: string;
}

export async function getAdminContracts(): Promise<AdminContractListRow[]> {
  const [rows] = await db.execute<AdminContractListRow[]>(
    `
      SELECT
        ec.id,
        ec.user_id,
        u.username,
        ec.first_name,
        ec.last_name,
        ec.age,
        ec.game_id,
        ec.ci_series,
        ec.phone_number,
        ec.city_hours,
        ec.identity_image_path,
        ec.accepted_rules,
        ec.employee_signature_name,
        ec.status,
        ec.contract_creation_blocked,
        ec.signed_at,
        ec.approved_by_user_id,
        COALESCE(
          NULLIF(
            TRIM(CONCAT_WS(' ', approved_contract.last_name, approved_contract.first_name)),
            ''
          ),
          approved_user.username,
          ec.approved_by_name
        ) AS approved_by_name,
        ec.admin_signature_path,
        ec.approved_at,
        ec.work_schedule,
        ec.contract_type,
        ec.contract_end_date,
        ec.rejected_by_user_id,
        COALESCE(
          NULLIF(
            TRIM(CONCAT_WS(' ', rejected_contract.last_name, rejected_contract.first_name)),
            ''
          ),
          rejected_user.username
        ) AS rejected_by_name,
        ec.rejected_at,
        ec.created_at,
        ec.updated_at
      FROM employee_contracts ec
      INNER JOIN users u
        ON u.id = ec.user_id
      LEFT JOIN users approved_user
        ON approved_user.id = ec.approved_by_user_id
      LEFT JOIN employee_contracts approved_contract
        ON approved_contract.user_id = ec.approved_by_user_id
      LEFT JOIN users rejected_user
        ON rejected_user.id = ec.rejected_by_user_id
      LEFT JOIN employee_contracts rejected_contract
        ON rejected_contract.user_id = ec.rejected_by_user_id
      ORDER BY
        CASE ec.status
          WHEN 'PENDING_REVIEW' THEN 0
          WHEN 'REJECTED' THEN 1
          WHEN 'APPROVED' THEN 2
          WHEN 'BLOCKED' THEN 3
          ELSE 4
        END,
        ec.signed_at DESC,
        ec.created_at DESC
    `,
  );

  return rows;
}

export interface PendingContractsCountRow extends RowDataPacket {
  pending_count: number;
}

export async function getPendingContractsCount(): Promise<number> {
  const [rows] = await db.execute<PendingContractsCountRow[]>(
    `
      SELECT COUNT(*) AS pending_count
      FROM employee_contracts
      WHERE status = 'PENDING_REVIEW'
    `,
  );

  return Number(rows[0]?.pending_count ?? 0);
}

export async function getAdminContractById(
  contractId: number,
): Promise<AdminContractListRow | null> {
  const [rows] = await db.execute<AdminContractListRow[]>(
    `
      SELECT
        ec.id,
        ec.user_id,
        u.username,
        ec.first_name,
        ec.last_name,
        ec.age,
        ec.game_id,
        ec.ci_series,
        ec.phone_number,
        ec.city_hours,
        ec.identity_image_path,
        ec.accepted_rules,
        ec.employee_signature_name,
        ec.status,
        ec.contract_creation_blocked,
        ec.signed_at,
        ec.approved_by_user_id,
        COALESCE(
          NULLIF(
            TRIM(CONCAT_WS(' ', approved_contract.last_name, approved_contract.first_name)),
            ''
          ),
          approved_user.username,
          ec.approved_by_name
        ) AS approved_by_name,
        ec.admin_signature_path,
        ec.approved_at,
        ec.work_schedule,
        ec.contract_type,
        ec.contract_end_date,
        ec.rejected_by_user_id,
        COALESCE(
          NULLIF(
            TRIM(CONCAT_WS(' ', rejected_contract.last_name, rejected_contract.first_name)),
            ''
          ),
          rejected_user.username
        ) AS rejected_by_name,
        ec.rejected_at,
        ec.created_at,
        ec.updated_at
      FROM employee_contracts ec
      INNER JOIN users u
        ON u.id = ec.user_id
      LEFT JOIN users approved_user
        ON approved_user.id = ec.approved_by_user_id
      LEFT JOIN employee_contracts approved_contract
        ON approved_contract.user_id = ec.approved_by_user_id
      LEFT JOIN users rejected_user
        ON rejected_user.id = ec.rejected_by_user_id
      LEFT JOIN employee_contracts rejected_contract
        ON rejected_contract.user_id = ec.rejected_by_user_id
      WHERE ec.id = ?
      LIMIT 1
    `,
    [contractId],
  );

  return rows[0] ?? null;
}

export async function rejectContract(
  contractId: number,
  rejectedByUserId: number,
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `
      UPDATE employee_contracts
      SET
        status = 'REJECTED',
        rejected_by_user_id = ?,
        rejected_at = CURRENT_TIMESTAMP,
        approved_at = NULL,
        approved_by_user_id = NULL,
        approved_by_name = NULL,
        admin_signature_path = NULL
      WHERE id = ?
        AND status = 'PENDING_REVIEW'
    `,
    [rejectedByUserId, contractId],
  );

  return result.affectedRows > 0;
}

export interface UpdateApprovedContractData {
  workSchedule: string;
  contractType: string;
  contractEndDate: string | null;
}

export async function updateApprovedContract(
  contractId: number,
  data: UpdateApprovedContractData,
): Promise<boolean> {
  const [result] = await db.execute<ResultSetHeader>(
    `
      UPDATE employee_contracts
      SET
        work_schedule = ?,
        contract_type = ?,
        contract_end_date = ?
      WHERE id = ?
        AND status = 'APPROVED'
    `,
    [
      data.workSchedule,
      data.contractType,
      data.contractEndDate,
      contractId,
    ],
  );

  return result.affectedRows > 0;
}

export interface UpdatePendingEmployeeContractData {
  firstName: string;
  lastName: string;
  age: number;
  gameId: string;
  ciSeries: string;
  phoneNumber: string;
  cityHours: number;
  identityImagePath: string;
  employeeSignatureName: string;
}

export async function updatePendingEmployeeContract(
  connection: PoolConnection,
  contractId: number,
  data: UpdatePendingEmployeeContractData,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      UPDATE employee_contracts
      SET
        first_name = ?,
        last_name = ?,
        age = ?,
        game_id = ?,
        ci_series = ?,
        phone_number = ?,
        city_hours = ?,
        identity_image_path = ?,
        accepted_rules = 1,
        employee_signature_name = ?,
        status = 'PENDING_REVIEW',
        signed_at = CURRENT_TIMESTAMP,
        approved_by_user_id = NULL,
        approved_by_name = NULL,
        admin_signature_path = NULL,
        approved_at = NULL,
        work_schedule = NULL,
        contract_type = NULL,
        contract_end_date = NULL,
        rejected_by_user_id = NULL,
        rejected_at = NULL
      WHERE id = ?
    `,
    [
      data.firstName,
      data.lastName,
      data.age,
      data.gameId,
      data.ciSeries,
      data.phoneNumber,
      data.cityHours,
      data.identityImagePath,
      data.employeeSignatureName,
      contractId,
    ],
  );
}

export interface CreateEmployeeContractData {
  userId: number;
  firstName: string;
  lastName: string;
  age: number;
  gameId: string;
  ciSeries: string;
  phoneNumber: string;
  cityHours: number;
  identityImagePath: string;
  employeeSignatureName: string;
}

export async function createPendingEmployeeContract(
  connection: PoolConnection,
  data: CreateEmployeeContractData,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO employee_contracts (
        user_id,
        first_name,
        last_name,
        age,
        game_id,
        ci_series,
        phone_number,
        city_hours,
        identity_image_path,
        accepted_rules,
        employee_signature_name,
        status,
        signed_at
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        1,
        ?,
        'PENDING_REVIEW',
        CURRENT_TIMESTAMP
      )
    `,
    [
      data.userId,
      data.firstName,
      data.lastName,
      data.age,
      data.gameId,
      data.ciSeries,
      data.phoneNumber,
      data.cityHours,
      data.identityImagePath,
      data.employeeSignatureName,
    ],
  );
}

interface RankExistsRow extends RowDataPacket {
  id: number;
}

export async function rankExists(
  connection: PoolConnection,
  rankId: number,
): Promise<boolean> {
  const [rows] = await connection.execute<RankExistsRow[]>(
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

export interface ContractApprovalRow extends RowDataPacket {
  id: number;
  user_id: number;
  status: ContractStatus;
}

export async function getContractForApproval(
  connection: PoolConnection,
  contractId: number,
): Promise<ContractApprovalRow | null> {
  const [rows] = await connection.execute<ContractApprovalRow[]>(
    `
      SELECT
        id,
        user_id,
        status
      FROM employee_contracts
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [contractId],
  );

  return rows[0] ?? null;
}

export interface ApproveEmployeeContractData {
  approverUserId: number;
  approverName: string;
  rankId: number;
  workSchedule: string;
  contractType: "FIXED" | "UNLIMITED";
  contractEndDate: string | null;
}

export async function approveEmployeeContract(
  connection: PoolConnection,
  contractId: number,
  userId: number,
  data: ApproveEmployeeContractData,
): Promise<boolean> {
  const [userResult] = await connection.execute<ResultSetHeader>(
    `
      UPDATE users
      SET
        user_role_id = (
          SELECT id
          FROM user_roles
          WHERE name = 'ANGAJAT'
          LIMIT 1
        ),
        user_rank_id = ?
      WHERE id = ?
        AND user_role_id = (
          SELECT id
          FROM user_roles
          WHERE name = 'GUEST'
          LIMIT 1
        )
    `,
    [data.rankId, userId],
  );

  if (userResult.affectedRows === 0) {
    return false;
  }

  await connection.execute<ResultSetHeader>(
    `
      UPDATE employee_contracts
      SET
        status = 'APPROVED',
        approved_by_user_id = ?,
        approved_by_name = ?,
        approved_at = CURRENT_TIMESTAMP,
        work_schedule = ?,
        contract_type = ?,
        contract_end_date = ?,
        rejected_by_user_id = NULL,
        rejected_at = NULL,
        admin_signature_path = NULL
      WHERE id = ?
    `,
    [
      data.approverUserId,
      data.approverName,
      data.workSchedule,
      data.contractType,
      data.contractEndDate,
      contractId,
    ],
  );

  return true;
}

export interface UserDisplayNameRow extends RowDataPacket {
  display_name: string;
}

export async function getUserDisplayName(
  connection: PoolConnection,
  userId: number,
  fallbackUsername: string,
): Promise<string> {
  const [rows] = await connection.execute<UserDisplayNameRow[]>(
    `
      SELECT
        COALESCE(
          NULLIF(
            TRIM(CONCAT_WS(' ', ec.last_name, ec.first_name)),
            ''
          ),
          u.username
        ) AS display_name
      FROM users u
      LEFT JOIN employee_contracts ec
        ON ec.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0]?.display_name?.trim() || fallbackUsername;
}

export interface ExistingContractRow extends RowDataPacket {
  id: number;
  status: ContractStatus;
  identity_image_path: string;
  contract_creation_blocked: number;
}

export async function getExistingContract(
  connection: PoolConnection,
  userId: number,
): Promise<ExistingContractRow | null> {
  const [rows] = await connection.execute<ExistingContractRow[]>(
    `
      SELECT
        id,
        status,
        identity_image_path,
        contract_creation_blocked
      FROM employee_contracts
      WHERE user_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [userId],
  );

  return rows[0] ?? null;
}

export interface GeneratedContractRow extends RowDataPacket {
  document_number: string;
  current_version: number;
  png_path: string;
  pdf_path: string;
  generated_at: Date;
}

export async function getGeneratedDocumentByUserId(
  userId: number,
): Promise<GeneratedContractRow | null> {
  const [rows] = await db.query<GeneratedContractRow[]>(
    `
      SELECT
        ed.document_number,
        ed.current_version,
        edv.png_path,
        edv.pdf_path,
        edv.generated_at
      FROM employee_documents ed

      INNER JOIN employee_document_versions edv
        ON edv.document_id = ed.id
        AND edv.version_number = ed.current_version

      INNER JOIN employee_contracts ec
        ON ec.id = ed.contract_id

      WHERE
        ec.user_id = ?
        AND ec.status = 'APPROVED'

      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

export async function getGeneratedDocumentByContractId(
  contractId: number,
): Promise<GeneratedContractRow | null> {
  const [rows] = await db.query<GeneratedContractRow[]>(
    `
      SELECT
        ed.document_number,
        ed.current_version,
        edv.png_path,
        edv.pdf_path,
        edv.generated_at
      FROM employee_documents ed

      INNER JOIN employee_document_versions edv
        ON edv.document_id = ed.id
        AND edv.version_number = ed.current_version

      WHERE ed.contract_id = ?

      LIMIT 1
    `,
    [contractId],
  );

  return rows[0] ?? null;
}