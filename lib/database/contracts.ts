import type { RowDataPacket } from "mysql2";
import type { ResultSetHeader } from "mysql2";
import { db } from "../db";

import type {
    ContractStatus,
} from "../types/users";

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
        ec.approved_by_name,
        ec.admin_signature_path,
        ec.approved_at,
        ec.rejected_by_user_id,
        rejected_user.username AS rejected_by_name,
        ec.rejected_at,
        ec.created_at,
        ec.updated_at
      FROM employee_contracts ec
      LEFT JOIN users rejected_user
        ON rejected_user.id = ec.rejected_by_user_id
      WHERE ec.user_id = ?
      LIMIT 1
    `,
        [userId],
    );

    return rows[0] ?? null;
}


export interface AdminContractListRow extends RowDataPacket {
    id: number;
    user_id: number;
    username: string;
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
    created_at: Date;
    updated_at: Date;
    rejected_by_user_id: number | null;
    rejected_by_name: string | null;
    rejected_at: string | null;
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
        ec.approved_by_name,
        ec.admin_signature_path,
        ec.approved_at,
        ec.rejected_at,
        ec.created_at,
        ec.updated_at
      FROM employee_contracts ec
      INNER JOIN users u
        ON u.id = ec.user_id
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
        ec.approved_by_name,
        ec.admin_signature_path,
        ec.approved_at,
        ec.rejected_by_user_id,
        rejected_user.username AS rejected_by_name,
        ec.rejected_at,
        ec.created_at,
        ec.updated_at
      FROM employee_contracts ec
      INNER JOIN users u
        ON u.id = ec.user_id
      LEFT JOIN users rejected_user
        ON rejected_user.id = ec.rejected_by_user_id
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