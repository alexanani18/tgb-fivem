import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { db } from "../db";
import { randomUUID } from "node:crypto";

export type WorkflowStatusCode =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type WorkflowHistoryAction =
  | "CREATED"
  | "UPDATED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "UNIFORM_RETURNED"
  | "COMPLETED";

export interface WorkflowType {
  id: number;
  code: string;
  requestPrefix: string;
  name: string;
  description: string | null;
}

export interface WorkflowStatus {
  id: number;
  code: WorkflowStatusCode;
  name: string;
  displayOrder: number;
}

export interface WorkflowRequest {
  id: number;
  requestNumber: string;
  workflowTypeId: number;
  userId: number;
  statusId: number;

  reviewedBy: number | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;

  discordChannelId: string | null;
  discordMessageId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowHistoryEntry {
  id: number;
  workflowRequestId: number;
  action: WorkflowHistoryAction;
  performedBy: number | null;
  oldStatusId: number | null;
  newStatusId: number | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface WorkflowTypeRow extends RowDataPacket {
  id: number;
  code: string;
  request_prefix: string;
  name: string;
  description: string | null;
}

interface WorkflowStatusRow extends RowDataPacket {
  id: number;
  code: WorkflowStatusCode;
  name: string;
  display_order: number;
}

interface WorkflowRequestRow extends RowDataPacket {
  id: number;
  request_number: string;
  workflow_type_id: number;
  user_id: number;
  status_id: number;

  reviewed_by: number | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;

  discord_channel_id: string | null;
  discord_message_id: string | null;

  created_at: Date;
  updated_at: Date;
}

interface WorkflowHistoryRow extends RowDataPacket {
  id: number;
  workflow_request_id: number;
  action: WorkflowHistoryAction;
  performed_by: number | null;
  old_status_id: number | null;
  new_status_id: number | null;
  comment: string | null;
  metadata: string | Record<string, unknown> | null;
  created_at: Date;
}

interface WorkflowRequestNumberRow extends RowDataPacket {
  id: number;
  request_prefix: string;
}

export interface CreateWorkflowRequestInput {
  workflowTypeId: number;
  userId: number;
  statusId: number;
}

export interface CreateWorkflowHistoryInput {
  workflowRequestId: number;
  action: WorkflowHistoryAction;
  performedBy?: number | null;
  oldStatusId?: number | null;
  newStatusId?: number | null;
  comment?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateWorkflowReviewInput {
  workflowRequestId: number;
  statusId: number;
  reviewedBy: number;
  rejectionReason?: string | null;
}

export interface AdminWorkflowRequestListItem {
  id: number;
  requestNumber: string;

  workflowTypeCode: string;
  workflowTypeName: string;

  statusCode: WorkflowStatusCode;
  statusName: string;

  userId: number;
  employeeName: string;

  reviewedBy: number | null;
  reviewerName: string | null;
  reviewedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

interface AdminWorkflowRequestListRow extends RowDataPacket {
  id: number;
  request_number: string;

  workflow_type_code: string;
  workflow_type_name: string;

  status_code: WorkflowStatusCode;
  status_name: string;

  user_id: number;
  employee_name: string | null;

  reviewed_by: number | null;
  reviewer_name: string | null;
  reviewed_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

interface PendingWorkflowCountRow extends RowDataPacket {
  pending_count: number;
}

export async function getPendingWorkflowRequestCount(): Promise<number> {
  const [rows] = await db.execute<PendingWorkflowCountRow[]>(
    `
      SELECT
        COUNT(*) AS pending_count
      FROM workflow_requests wr

      INNER JOIN workflow_statuses ws
        ON ws.id = wr.status_id

      WHERE ws.code = 'PENDING'
    `,
  );

  return Number(rows[0]?.pending_count ?? 0);
}

function mapAdminWorkflowRequestListItem(
  row: AdminWorkflowRequestListRow,
): AdminWorkflowRequestListItem {
  return {
    id: Number(row.id),
    requestNumber: row.request_number,

    workflowTypeCode: row.workflow_type_code,
    workflowTypeName: row.workflow_type_name,

    statusCode: row.status_code,
    statusName: row.status_name,

    userId: Number(row.user_id),
    employeeName: row.employee_name ?? "Nume indisponibil",

    reviewedBy: row.reviewed_by === null ? null : Number(row.reviewed_by),

    reviewerName: row.reviewer_name,
    reviewedAt: row.reviewed_at,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAdminWorkflowRequests(): Promise<
  AdminWorkflowRequestListItem[]
> {
  const [rows] = await db.execute<AdminWorkflowRequestListRow[]>(
    `
      SELECT
        wr.id,
        wr.request_number,

        wt.code AS workflow_type_code,
        wt.name AS workflow_type_name,

        ws.code AS status_code,
        ws.name AS status_name,

        wr.user_id,

        CONCAT_WS(
          ' ',
          employee_contract.first_name,
          employee_contract.last_name
        ) AS employee_name,

        wr.reviewed_by,

        CONCAT_WS(
          ' ',
          reviewer_contract.first_name,
          reviewer_contract.last_name
        ) AS reviewer_name,

        wr.reviewed_at,
        wr.created_at,
        wr.updated_at

      FROM workflow_requests wr

      INNER JOIN workflow_types wt
        ON wt.id = wr.workflow_type_id

      INNER JOIN workflow_statuses ws
        ON ws.id = wr.status_id

      LEFT JOIN employee_contracts employee_contract
        ON employee_contract.user_id = wr.user_id

      LEFT JOIN employee_contracts reviewer_contract
        ON reviewer_contract.user_id = wr.reviewed_by

      ORDER BY
        CASE ws.code
          WHEN 'PENDING' THEN 1
          WHEN 'APPROVED' THEN 2
          WHEN 'REJECTED' THEN 3
          WHEN 'CANCELLED' THEN 4
          ELSE 5
        END,
        wr.created_at DESC,
        wr.id DESC
    `,
  );

  return rows.map(mapAdminWorkflowRequestListItem);
}

function mapWorkflowType(row: WorkflowTypeRow): WorkflowType {
  return {
    id: Number(row.id),
    code: row.code,
    requestPrefix: row.request_prefix,
    name: row.name,
    description: row.description,
  };
}

function mapWorkflowStatus(row: WorkflowStatusRow): WorkflowStatus {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    displayOrder: Number(row.display_order),
  };
}

function mapWorkflowRequest(row: WorkflowRequestRow): WorkflowRequest {
  return {
    id: Number(row.id),
    requestNumber: row.request_number,
    workflowTypeId: Number(row.workflow_type_id),
    userId: Number(row.user_id),
    statusId: Number(row.status_id),

    reviewedBy: row.reviewed_by === null ? null : Number(row.reviewed_by),

    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,

    discordChannelId: row.discord_channel_id,
    discordMessageId: row.discord_message_id,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseMetadata(
  metadata: string | Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (metadata === null) {
    return null;
  }

  if (typeof metadata === "object") {
    return metadata;
  }

  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapWorkflowHistory(row: WorkflowHistoryRow): WorkflowHistoryEntry {
  return {
    id: Number(row.id),
    workflowRequestId: Number(row.workflow_request_id),
    action: row.action,

    performedBy: row.performed_by === null ? null : Number(row.performed_by),

    oldStatusId: row.old_status_id === null ? null : Number(row.old_status_id),

    newStatusId: row.new_status_id === null ? null : Number(row.new_status_id),

    comment: row.comment,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

/*
|--------------------------------------------------------------------------
| Workflow Types
|--------------------------------------------------------------------------
*/

export async function getWorkflowTypeByCode(
  code: string,
): Promise<WorkflowType | null> {
  const [rows] = await db.execute<WorkflowTypeRow[]>(
    `
      SELECT
        id,
        code,
        request_prefix,
        name,
        description
      FROM workflow_types
      WHERE code = ?
      LIMIT 1
    `,
    [code],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowType(rows[0]);
}

/*
|--------------------------------------------------------------------------
| Workflow Statuses
|--------------------------------------------------------------------------
*/

export async function getWorkflowStatusByCode(
  code: WorkflowStatusCode,
): Promise<WorkflowStatus | null> {
  const [rows] = await db.execute<WorkflowStatusRow[]>(
    `
      SELECT
        id,
        code,
        name,
        display_order
      FROM workflow_statuses
      WHERE code = ?
      LIMIT 1
    `,
    [code],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowStatus(rows[0]);
}

export async function getWorkflowStatusByCodeWithConnection(
  connection: PoolConnection,
  code: WorkflowStatusCode,
): Promise<WorkflowStatus | null> {
  const [rows] = await connection.execute<WorkflowStatusRow[]>(
    `
      SELECT
        id,
        code,
        name,
        display_order
      FROM workflow_statuses
      WHERE code = ?
      LIMIT 1
    `,
    [code],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowStatus(rows[0]);
}

/*
|--------------------------------------------------------------------------
| Workflow Requests
|--------------------------------------------------------------------------
*/

export async function createWorkflowRequest(
  connection: PoolConnection,
  input: CreateWorkflowRequestInput,
): Promise<WorkflowRequest> {
  /*
   * Request number-ul final depinde de ID-ul generat de MySQL.
   * Introducem întâi o valoare temporară unică, apoi folosim insertId
   * pentru numărul public al cererii.
   */

  const temporaryRequestNumber = `TMP-${randomUUID()}`;

  const [result] = await connection.execute<ResultSetHeader>(
    `
      INSERT INTO workflow_requests (
        request_number,
        workflow_type_id,
        user_id,
        status_id
      )
      VALUES (?, ?, ?, ?)
    `,
    [
      temporaryRequestNumber,
      input.workflowTypeId,
      input.userId,
      input.statusId,
    ],
  );

  const workflowRequestId = Number(result.insertId);

  const [requestNumberRows] = await connection.execute<
    WorkflowRequestNumberRow[]
  >(
    `
        SELECT
          wr.id,
          wt.request_prefix
        FROM workflow_requests wr

        INNER JOIN workflow_types wt
          ON wt.id = wr.workflow_type_id

        WHERE wr.id = ?
        LIMIT 1
      `,
    [workflowRequestId],
  );

  if (requestNumberRows.length === 0) {
    throw new Error("Workflow request could not be loaded after creation.");
  }

  const row = requestNumberRows[0];

  const requestNumber = `${row.request_prefix}-${String(
    workflowRequestId,
  ).padStart(6, "0")}`;

  await connection.execute<ResultSetHeader>(
    `
      UPDATE workflow_requests
      SET request_number = ?
      WHERE id = ?
    `,
    [requestNumber, workflowRequestId],
  );

  const workflowRequest = await getWorkflowRequestByIdWithConnection(
    connection,
    workflowRequestId,
  );

  if (!workflowRequest) {
    throw new Error("Workflow request could not be loaded after creation.");
  }

  return workflowRequest;
}

export async function getWorkflowRequestById(
  workflowRequestId: number,
): Promise<WorkflowRequest | null> {
  const [rows] = await db.execute<WorkflowRequestRow[]>(
    `
      SELECT
        id,
        request_number,
        workflow_type_id,
        user_id,
        status_id,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        discord_channel_id,
        discord_message_id,
        created_at,
        updated_at
      FROM workflow_requests
      WHERE id = ?
      LIMIT 1
    `,
    [workflowRequestId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowRequest(rows[0]);
}

export async function getWorkflowRequestByIdWithConnection(
  connection: PoolConnection,
  workflowRequestId: number,
): Promise<WorkflowRequest | null> {
  const [rows] = await connection.execute<WorkflowRequestRow[]>(
    `
      SELECT
        id,
        request_number,
        workflow_type_id,
        user_id,
        status_id,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        discord_channel_id,
        discord_message_id,
        created_at,
        updated_at
      FROM workflow_requests
      WHERE id = ?
      LIMIT 1
    `,
    [workflowRequestId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowRequest(rows[0]);
}

export async function updateWorkflowReview(
  connection: PoolConnection,
  input: UpdateWorkflowReviewInput,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      UPDATE workflow_requests
      SET
        status_id = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP,
        rejection_reason = ?
      WHERE id = ?
    `,
    [
      input.statusId,
      input.reviewedBy,
      input.rejectionReason ?? null,
      input.workflowRequestId,
    ],
  );
}

export async function updateWorkflowStatus(
  connection: PoolConnection,
  workflowRequestId: number,
  statusId: number,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      UPDATE workflow_requests
      SET status_id = ?
      WHERE id = ?
    `,
    [statusId, workflowRequestId],
  );
}

/*
|--------------------------------------------------------------------------
| Discord Reference
|--------------------------------------------------------------------------
*/

export async function updateWorkflowDiscordReference(
  workflowRequestId: number,
  discordChannelId: string,
  discordMessageId: string,
): Promise<void> {
  await db.execute<ResultSetHeader>(
    `
      UPDATE workflow_requests
      SET
        discord_channel_id = ?,
        discord_message_id = ?
      WHERE id = ?
    `,
    [discordChannelId, discordMessageId, workflowRequestId],
  );
}

/*
|--------------------------------------------------------------------------
| History
|--------------------------------------------------------------------------
*/

export async function createWorkflowHistory(
  connection: PoolConnection,
  input: CreateWorkflowHistoryInput,
): Promise<number> {
  const metadata =
    input.metadata === undefined || input.metadata === null
      ? null
      : JSON.stringify(input.metadata);

  const [result] = await connection.execute<ResultSetHeader>(
    `
      INSERT INTO workflow_request_history (
        workflow_request_id,
        action,
        performed_by,
        old_status_id,
        new_status_id,
        comment,
        metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.workflowRequestId,
      input.action,
      input.performedBy ?? null,
      input.oldStatusId ?? null,
      input.newStatusId ?? null,
      input.comment ?? null,
      metadata,
    ],
  );

  return Number(result.insertId);
}

export async function getWorkflowHistory(
  workflowRequestId: number,
): Promise<WorkflowHistoryEntry[]> {
  const [rows] = await db.execute<WorkflowHistoryRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        action,
        performed_by,
        old_status_id,
        new_status_id,
        comment,
        metadata,
        created_at
      FROM workflow_request_history
      WHERE workflow_request_id = ?
      ORDER BY created_at ASC, id ASC
    `,
    [workflowRequestId],
  );

  return rows.map(mapWorkflowHistory);
}
