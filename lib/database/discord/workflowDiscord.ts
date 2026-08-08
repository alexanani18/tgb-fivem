import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { db } from "../../db";

export interface WorkflowDiscordChannel {
  id: number;
  workflowTypeId: number;
  workflowTypeCode: string;
  workflowTypeName: string;
  requestPrefix: string;

  discordChannelId: string | null;
  isEnabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowDiscordMessage {
  id: number;
  workflowRequestId: number;
  discordChannelId: string;
  discordMessageId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowDiscordChannelRow extends RowDataPacket {
  id: number;
  workflow_type_id: number;
  workflow_type_code: string;
  workflow_type_name: string;
  request_prefix: string;

  discord_channel_id: string | null;
  is_enabled: number;

  created_at: Date;
  updated_at: Date;
}

interface WorkflowDiscordMessageRow extends RowDataPacket {
  id: number;
  workflow_request_id: number;
  discord_channel_id: string;
  discord_message_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateWorkflowDiscordChannelInput {
  workflowTypeId: number;
  discordChannelId: string | null;
  isEnabled: boolean;
}

export interface SaveWorkflowDiscordMessageInput {
  workflowRequestId: number;
  discordChannelId: string;
  discordMessageId: string;
}

export interface WorkflowDiscordRequestSnapshot {
  workflowRequestId: number;
  requestNumber: string;

  workflowTypeCode: string;
  workflowTypeName: string;

  statusCode: string;

  employeeName: string;

  reviewedByName: string | null;
  reviewedAt: Date | null;

  effectiveDate: string | Date | null;
  reason: string | null;

  leaveStartDate: string | Date | null;
  leaveEndDate: string | Date | null;

  uniformReturned: boolean;
  uniformReturnedAt: Date | null;

  completedAt: Date | null;
}

interface WorkflowDiscordRequestSnapshotRow extends RowDataPacket {
  workflow_request_id: number;
  request_number: string;

  workflow_type_code: string;
  workflow_type_name: string;

  status_code: string;

  employee_name: string | null;

  reviewed_by_name: string | null;
  reviewed_at: Date | null;

  effective_date: string | Date | null;
  reason: string | null;

  leave_start_date: string | Date | null;
  leave_end_date: string | Date | null;

  uniform_returned: number | null;
  uniform_returned_at: Date | null;

  completed_at: Date | null;
}

interface WorkflowDiscordActorNameRow extends RowDataPacket {
  display_name: string | null;
  username: string;
}

function mapWorkflowDiscordRequestSnapshot(
  row: WorkflowDiscordRequestSnapshotRow,
): WorkflowDiscordRequestSnapshot {
  return {
    workflowRequestId: Number(row.workflow_request_id),
    requestNumber: row.request_number,

    workflowTypeCode: row.workflow_type_code,
    workflowTypeName: row.workflow_type_name,

    statusCode: row.status_code,

    employeeName: row.employee_name?.trim() || "Nume indisponibil",

    reviewedByName: row.reviewed_by_name?.trim() || null,

    reviewedAt: row.reviewed_at,

    effectiveDate: row.effective_date,
    reason: row.reason,

    leaveStartDate: row.leave_start_date,
    leaveEndDate: row.leave_end_date,

    uniformReturned: Boolean(row.uniform_returned),

    uniformReturnedAt: row.uniform_returned_at,

    completedAt: row.completed_at,
  };
}

export async function getWorkflowDiscordRequestSnapshot(
  workflowRequestId: number,
): Promise<WorkflowDiscordRequestSnapshot | null> {
  const [rows] = await db.execute<WorkflowDiscordRequestSnapshotRow[]>(
    `
        SELECT
          wr.id AS workflow_request_id,
          wr.request_number,

          wt.code AS workflow_type_code,
          wt.name AS workflow_type_name,

          ws.code AS status_code,

          CONCAT_WS(
            ' ',
            employee_contract.first_name,
            employee_contract.last_name
          ) AS employee_name,

          CONCAT_WS(
            ' ',
            reviewer_contract.first_name,
            reviewer_contract.last_name
          ) AS reviewed_by_name,

          wr.reviewed_at,

          rr.effective_date,

          COALESCE(lr.reason, rr.reason) AS reason,

          lr.start_date AS leave_start_date,
          lr.end_date AS leave_end_date,

          rr.uniform_returned,
          rr.uniform_returned_at,
          rr.completed_at

        FROM workflow_requests wr

        INNER JOIN workflow_types wt
          ON wt.id = wr.workflow_type_id

        INNER JOIN workflow_statuses ws
          ON ws.id = wr.status_id

        LEFT JOIN resignation_requests rr
          ON rr.workflow_request_id = wr.id

        LEFT JOIN leave_requests lr
          ON lr.workflow_request_id = wr.id

        LEFT JOIN employee_contracts employee_contract
          ON employee_contract.user_id = wr.user_id

        LEFT JOIN employee_contracts reviewer_contract
          ON reviewer_contract.user_id = wr.reviewed_by

        WHERE wr.id = ?
        LIMIT 1
      `,
    [workflowRequestId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowDiscordRequestSnapshot(rows[0]);
}

function mapWorkflowDiscordChannel(
  row: WorkflowDiscordChannelRow,
): WorkflowDiscordChannel {
  return {
    id: Number(row.id),
    workflowTypeId: Number(row.workflow_type_id),
    workflowTypeCode: row.workflow_type_code,
    workflowTypeName: row.workflow_type_name,
    requestPrefix: row.request_prefix,

    discordChannelId: row.discord_channel_id,
    isEnabled: Boolean(row.is_enabled),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkflowDiscordMessage(
  row: WorkflowDiscordMessageRow,
): WorkflowDiscordMessage {
  return {
    id: Number(row.id),
    workflowRequestId: Number(row.workflow_request_id),
    discordChannelId: row.discord_channel_id,
    discordMessageId: row.discord_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkflowDiscordChannels(): Promise<
  WorkflowDiscordChannel[]
> {
  const [rows] = await db.execute<WorkflowDiscordChannelRow[]>(
    `
      SELECT
        wdc.id,
        wdc.workflow_type_id,

        wt.code AS workflow_type_code,
        wt.name AS workflow_type_name,
        wt.request_prefix,

        wdc.discord_channel_id,
        wdc.is_enabled,

        wdc.created_at,
        wdc.updated_at

      FROM workflow_discord_channels wdc

      INNER JOIN workflow_types wt
        ON wt.id = wdc.workflow_type_id

      ORDER BY wt.name ASC
    `,
  );

  return rows.map(mapWorkflowDiscordChannel);
}

export async function getWorkflowDiscordChannelByTypeId(
  workflowTypeId: number,
): Promise<WorkflowDiscordChannel | null> {
  const [rows] = await db.execute<WorkflowDiscordChannelRow[]>(
    `
      SELECT
        wdc.id,
        wdc.workflow_type_id,

        wt.code AS workflow_type_code,
        wt.name AS workflow_type_name,
        wt.request_prefix,

        wdc.discord_channel_id,
        wdc.is_enabled,

        wdc.created_at,
        wdc.updated_at

      FROM workflow_discord_channels wdc

      INNER JOIN workflow_types wt
        ON wt.id = wdc.workflow_type_id

      WHERE wdc.workflow_type_id = ?
      LIMIT 1
    `,
    [workflowTypeId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowDiscordChannel(rows[0]);
}

export async function getWorkflowDiscordChannelByTypeCode(
  workflowTypeCode: string,
): Promise<WorkflowDiscordChannel | null> {
  const [rows] = await db.execute<WorkflowDiscordChannelRow[]>(
    `
      SELECT
        wdc.id,
        wdc.workflow_type_id,

        wt.code AS workflow_type_code,
        wt.name AS workflow_type_name,
        wt.request_prefix,

        wdc.discord_channel_id,
        wdc.is_enabled,

        wdc.created_at,
        wdc.updated_at

      FROM workflow_discord_channels wdc

      INNER JOIN workflow_types wt
        ON wt.id = wdc.workflow_type_id

      WHERE wt.code = ?
      LIMIT 1
    `,
    [workflowTypeCode],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowDiscordChannel(rows[0]);
}

export async function updateWorkflowDiscordChannel(
  input: UpdateWorkflowDiscordChannelInput,
): Promise<WorkflowDiscordChannel> {
  await db.execute<ResultSetHeader>(
    `
      UPDATE workflow_discord_channels
      SET
        discord_channel_id = ?,
        is_enabled = ?
      WHERE workflow_type_id = ?
    `,
    [input.discordChannelId, input.isEnabled ? 1 : 0, input.workflowTypeId],
  );

  const updatedChannel = await getWorkflowDiscordChannelByTypeId(
    input.workflowTypeId,
  );

  if (!updatedChannel) {
    throw new Error("Workflow Discord channel configuration was not found.");
  }

  return updatedChannel;
}

export async function getWorkflowDiscordMessage(
  workflowRequestId: number,
): Promise<WorkflowDiscordMessage | null> {
  const [rows] = await db.execute<WorkflowDiscordMessageRow[]>(
    `
      SELECT
        id,
        workflow_request_id,
        discord_channel_id,
        discord_message_id,
        created_at,
        updated_at
      FROM workflow_discord_messages
      WHERE workflow_request_id = ?
      LIMIT 1
    `,
    [workflowRequestId],
  );

  if (rows.length === 0) {
    return null;
  }

  return mapWorkflowDiscordMessage(rows[0]);
}

export async function saveWorkflowDiscordMessage(
  input: SaveWorkflowDiscordMessageInput,
): Promise<WorkflowDiscordMessage> {
  await db.execute<ResultSetHeader>(
    `
      INSERT INTO workflow_discord_messages (
        workflow_request_id,
        discord_channel_id,
        discord_message_id
      )
      VALUES (?, ?, ?)

      ON DUPLICATE KEY UPDATE
        discord_channel_id = VALUES(discord_channel_id),
        discord_message_id = VALUES(discord_message_id)
    `,
    [input.workflowRequestId, input.discordChannelId, input.discordMessageId],
  );

  const message = await getWorkflowDiscordMessage(input.workflowRequestId);

  if (!message) {
    throw new Error(
      "Workflow Discord message could not be loaded after saving.",
    );
  }

  return message;
}

export async function getWorkflowDiscordActorName(
  userId: number,
): Promise<string> {
  const [rows] = await db.execute<WorkflowDiscordActorNameRow[]>(
    `
      SELECT
        NULLIF(
          TRIM(
            CONCAT_WS(
              ' ',
              employee_contract.first_name,
              employee_contract.last_name
            )
          ),
          ''
        ) AS display_name,
        u.username

      FROM users u

      LEFT JOIN employee_contracts employee_contract
        ON employee_contract.user_id = u.id

      WHERE u.id = ?
      LIMIT 1
    `,
    [userId],
  );

  const user = rows[0];

  if (!user) {
    return "Administrator necunoscut";
  }

  return user.display_name?.trim() || user.username;
}
